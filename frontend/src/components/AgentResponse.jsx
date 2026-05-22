import React, { useState } from 'react';

const AgentResponse = ({ content, chatId }) => {
  const [activeTab, setActiveTab] = useState('preview');
  
  if (!content) return null;
  
  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    return <div className="message-text">{content}</div>;
  }

  // If it's just a simple text message (from user or simple error)
  if (!data.html_code) {
    return <div className="message-text">{data.text || JSON.stringify(data)}</div>;
  }

  const API_URL = 'http://localhost:8000';
  const token = localStorage.getItem('token');

  return (
    <div className="agent-response-container">
      <div className="message-text" style={{ marginBottom: '1rem' }}>
        {data.text}
      </div>
      
      <div className="agent-tabs">
        <div className="tab-headers">
          <button 
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            Code
          </button>
          <button 
            className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
          <button 
            className={`tab-btn ${activeTab === 'steps' ? 'active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            Steps
          </button>
        </div>
        
        <div className="tab-content">
          {activeTab === 'preview' && (
            <iframe 
              srcDoc={data.html_code} 
              className="html-preview" 
              title="Agent Output"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
          
          {activeTab === 'code' && (
            <div className="code-block">
              {data.html_code}
            </div>
          )}
          
          {activeTab === 'files' && (
            <div>
              {data.names_of_required_files && data.names_of_required_files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.names_of_required_files.map((file, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <span>{file}</span>
                      <a 
                        href={`${API_URL}/chats/${chatId}/files/${file}?token=${token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ textDecoration: 'none', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No files generated.</p>
              )}
            </div>
          )}
          
          {activeTab === 'steps' && (
            <div style={{ padding: '1rem' }}>
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {data.list_of_steps_you_did && data.list_of_steps_you_did.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: '0.5rem' }}>• {step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentResponse;
