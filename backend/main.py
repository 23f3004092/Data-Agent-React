import os
import json
import asyncio
import queue as q_module
import threading

from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import List

import models, schemas, auth, database, agent
from database import engine
from agent import TraceCallbackHandler

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── helpers ────────────────────────────────────────────────

def _build_agent_messages(chat_id: int, db_messages, new_prompt: str):
    """Build the full message list the agent will receive."""
    chat_dir = os.path.join("uploads", str(chat_id))
    os.makedirs(chat_dir, exist_ok=True)
    dir_context = (
        f"The directory for this chat's files is `{chat_dir}/`. "
        f"ALWAYS read from and write to this directory. "
        f"Prepend `{chat_dir}/` to all file paths when reading or saving files."
    )
    msgs = [{"role": "user", "content": dir_context}]
    for msg in db_messages:
        try:
            content_dict = json.loads(msg.content)
        except Exception:
            content_dict = {"text": msg.content}
        if msg.role == "user":
            msgs.append({"role": "user", "content": content_dict.get("text", "")})
        else:
            if "text" in content_dict:
                summary = content_dict["text"]
                files   = content_dict.get("names_of_required_files", [])
                msgs.append({
                    "role": "assistant",
                    "content": f"{summary}\n\n[ARTIFACTS] Files: {', '.join(files)}"
                })
    msgs.append({"role": "user", "content": new_prompt})
    return msgs


def sse(payload: dict) -> str:
    """Format a dict as a single SSE `data:` line."""
    return f"data: {json.dumps(payload)}\n\n"


# ─── auth endpoints ──────────────────────────────────────────

@app.post("/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


# ─── chat endpoints ──────────────────────────────────────────

@app.get("/chats", response_model=List[schemas.ChatResponse])
def get_chats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    chats = db.query(models.Chat).filter(models.Chat.user_id == current_user.id).all()
    return chats

@app.post("/chats", response_model=schemas.ChatResponse)
def create_chat(chat: schemas.ChatCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    new_chat = models.Chat(title=chat.title, user_id=current_user.id)
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

@app.get("/chats/{chat_id}/messages", response_model=List[schemas.MessageResponse])
def get_messages(chat_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    messages = db.query(models.Message).filter(models.Message.chat_id == chat_id).all()
    
    # Detach messages from session to prevent auto-saving transient content injections
    for msg in messages:
        db.expunge(msg)
        
    # Dynamically read JSON and CSV files from the chat folder and inject them
    chat_dir = os.path.join("uploads", str(chat_id))
    files_data = {}
    if os.path.exists(chat_dir):
        for f_name in os.listdir(chat_dir):
            if f_name.endswith('.json') or f_name.endswith('.csv'):
                file_path = os.path.join(chat_dir, f_name)
                if os.path.isfile(file_path):
                    try:
                        with open(file_path, "r", encoding="utf8") as f:
                            files_data[f_name] = f.read()
                    except Exception as e:
                        print(f"Error reading file {f_name} during messages fetch: {e}")
                        
    for msg in messages:
        if msg.role == "assistant":
            try:
                parsed = json.loads(msg.content)
                if isinstance(parsed, dict):
                    orig_files = parsed.get("files_data") or {}
                    merged_files = {**orig_files, **files_data}
                    parsed["files_data"] = merged_files
                    msg.content = json.dumps(parsed)
            except Exception:
                pass
                
    return messages

@app.post("/chats/{chat_id}/upload")
async def upload_file(chat_id: int, file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    upload_dir = os.path.join("uploads", str(chat_id))
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    return {"filename": file.filename, "path": file_path}


# ─── streaming message endpoint ──────────────────────────────

@app.post("/chats/{chat_id}/message/stream")
async def stream_message(
    chat_id: int,
    message: schemas.MessageCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db),
):
    chat = db.query(models.Chat).filter(
        models.Chat.id == chat_id, models.Chat.user_id == current_user.id
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Build history & save user message
    db_messages   = db.query(models.Message).filter(models.Message.chat_id == chat_id).all()
    agent_messages = _build_agent_messages(chat_id, db_messages, message.content)

    user_content = json.dumps({"text": message.content})
    db.add(models.Message(chat_id=chat_id, role="user", content=user_content))
    db.commit()

    # Inter-thread communication
    trace_queue: q_module.Queue = q_module.Queue()
    result_holder: dict = {}
    error_holder:  dict = {}

    def agent_thread():
        try:
            cb = TraceCallbackHandler(trace_queue)
            result_holder["response"] = agent.run_agent(agent_messages, callbacks=[cb])
        except Exception as exc:
            error_holder["error"] = str(exc)
        finally:
            trace_queue.put(None)  # sentinel — signals generator to close

    threading.Thread(target=agent_thread, daemon=True).start()

    # SSE generator — polls the queue, yields events to the client
    async def generate():
        # Yield a keepalive so the browser knows the connection is alive
        yield sse({"type": "connected"})

        while True:
            try:
                event = trace_queue.get_nowait()
            except q_module.Empty:
                await asyncio.sleep(0.08)   # poll every 80 ms
                continue

            if event is None:
                # Agent thread finished — process result
                if "error" in error_holder:
                    err_json = json.dumps({"text": f"Error: {error_holder['error']}"})
                    db_session = database.SessionLocal()
                    try:
                        msg = models.Message(chat_id=chat_id, role="assistant", content=err_json)
                        db_session.add(msg)
                        db_session.commit()
                        db_session.refresh(msg)
                        yield sse({
                            "type": "done",
                            "message": {
                                "id": msg.id, "chat_id": msg.chat_id,
                                "role": msg.role, "content": msg.content,
                                "created_at": msg.created_at.isoformat()
                            }
                        })
                    finally:
                        db_session.close()
                else:
                    response = result_holder.get("response", {})
                    result   = response.get("structured_response")
                    files_data = {}
                    chat_dir = os.path.join("uploads", str(chat_id))
                    # Load files explicitly listed in names_of_required_files
                    for filename in (result.names_of_required_files if result else []):
                        file_path = os.path.join(chat_dir, filename)
                        if os.path.exists(file_path) and os.path.isfile(file_path):
                            try:
                                with open(file_path, "r", encoding="utf8") as f:
                                    files_data[filename] = f.read()
                            except Exception as e:
                                print(f"Error reading file {filename}: {e}")
                    # Load all other JSON and CSV files in the chat directory
                    if os.path.exists(chat_dir):
                        for f_name in os.listdir(chat_dir):
                            if f_name.endswith('.json') or f_name.endswith('.csv'):
                                if f_name not in files_data:
                                    file_path = os.path.join(chat_dir, f_name)
                                    if os.path.isfile(file_path):
                                        try:
                                            with open(file_path, "r", encoding="utf8") as f:
                                                files_data[f_name] = f.read()
                                        except Exception as e:
                                            print(f"Error reading file {f_name}: {e}")
                    assistant_dict = {
                        "text": result.simple_response if result else "",
                        "html_code": result.html_code if result else "",
                        "names_of_required_files": result.names_of_required_files if result else [],
                        "files_data": files_data,
                        "list_of_steps_you_did": result.list_of_steps_you_did if result else [],
                    }
                    assistant_content = json.dumps(assistant_dict)
                    db_session = database.SessionLocal()
                    try:
                        msg = models.Message(chat_id=chat_id, role="assistant", content=assistant_content)
                        db_session.add(msg)
                        db_session.commit()
                        db_session.refresh(msg)
                        yield sse({
                            "type": "done",
                            "message": {
                                "id": msg.id, "chat_id": msg.chat_id,
                                "role": msg.role, "content": msg.content,
                                "created_at": msg.created_at.isoformat()
                            }
                        })
                    finally:
                        db_session.close()
                break

            # Normal trace event — relay straight to client
            yield sse(event)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
            "Connection":       "keep-alive",
        },
    )


# ─── fallback non-streaming endpoint (kept for compatibility) ─

@app.post("/chats/{chat_id}/message", response_model=schemas.MessageResponse)
def send_message(chat_id: int, message: schemas.MessageCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db_messages    = db.query(models.Message).filter(models.Message.chat_id == chat_id).all()
    agent_messages = _build_agent_messages(chat_id, db_messages, message.content)
    db.add(models.Message(chat_id=chat_id, role="user", content=json.dumps({"text": message.content})))
    db.commit()
    try:
        response = agent.run_agent(agent_messages)
        result   = response["structured_response"]
        files_data = {}
        chat_dir = os.path.join("uploads", str(chat_id))
        # Load files explicitly listed in names_of_required_files
        for filename in (result.names_of_required_files if result else []):
            file_path = os.path.join(chat_dir, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                try:
                    with open(file_path, "r", encoding="utf8") as f:
                        files_data[filename] = f.read()
                except Exception as e:
                    print(f"Error reading file {filename}: {e}")
        # Load all other JSON and CSV files in the chat directory
        if os.path.exists(chat_dir):
            for f_name in os.listdir(chat_dir):
                if f_name.endswith('.json') or f_name.endswith('.csv'):
                    if f_name not in files_data:
                        file_path = os.path.join(chat_dir, f_name)
                        if os.path.isfile(file_path):
                            try:
                                with open(file_path, "r", encoding="utf8") as f:
                                    files_data[f_name] = f.read()
                            except Exception as e:
                                print(f"Error reading file {f_name}: {e}")
        assistant_dict = {
            "text": result.simple_response,
            "html_code": result.html_code,
            "names_of_required_files": result.names_of_required_files,
            "files_data": files_data,
            "list_of_steps_you_did": result.list_of_steps_you_did,
        }
        msg = models.Message(chat_id=chat_id, role="assistant", content=json.dumps(assistant_dict))
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg
    except Exception as e:
        msg = models.Message(chat_id=chat_id, role="assistant", content=json.dumps({"text": f"Error: {str(e)}"}))
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg


# ─── file download endpoint ───────────────────────────────────

@app.get("/chats/{chat_id}/files/{filename}")
def get_file(chat_id: int, filename: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id, models.Chat.user_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    file_path = os.path.join("uploads", str(chat_id), filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
