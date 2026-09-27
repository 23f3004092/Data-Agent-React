import React, { useState } from 'react';
import { vb } from '../theme/voiceBox';

const AgentResponse = ({ content, chatId }) => {
  const [activeTab, setActiveTab] = useState('preview');

  if (!content) return null;

  let data;
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (e) {
    return <div style={{ fontFamily: vb.ffBody, fontSize: 16, lineHeight: 1.7 }}>{content}</div>;
  }

  if (!data.html_code) {
    return (
      <div style={{ fontFamily: vb.ffBody, fontSize: 16, lineHeight: 1.7 }}>
        {data.text || JSON.stringify(data)}
      </div>
    );
  }

  const API_URL = 'http://localhost:8000';
  const token = localStorage.getItem('token');

  const tabs = ['preview', 'code', 'files', 'steps'];

  return (
    <div>
      <div style={{
        fontFamily: vb.ffBody,
        fontSize: 16,
        lineHeight: 1.7,
        marginBottom: '16px',
      }}>
        {data.text}
      </div>

      <div>
        <div style={{ display: 'flex', borderBottom: `2px solid ${vb.borderSubtle}` }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? `3px solid ${vb.red}` : '3px solid transparent',
                fontFamily: vb.ffBody,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: activeTab === tab ? vb.black : vb.textTertiary,
                padding: '8px 16px',
                cursor: 'pointer',
                marginBottom: '-2px',
                transition: 'color 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{
          border: `2px solid ${vb.borderSubtle}`,
          borderTop: 'none',
          padding: '16px',
          minHeight: '200px',
        }}>
          {activeTab === 'preview' && (
            <iframe
              srcDoc={data.html_code}
              title="Agent Output"
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: '100%',
                height: '400px',
                border: 'none',
                background: vb.white,
              }}
            />
          )}

          {activeTab === 'code' && (
            <pre style={{
              fontFamily: vb.ffMono,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: vb.textPrimary,
              margin: 0,
            }}>
              {data.html_code}
            </pre>
          )}

          {activeTab === 'files' && (
            <div>
              {data.names_of_required_files && data.names_of_required_files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.names_of_required_files.map((file, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      border: `2px solid ${vb.borderSubtle}`,
                      fontFamily: vb.ffBody,
                      fontSize: 14,
                    }}>
                      <span style={{ fontWeight: 500 }}>{file}</span>
                      <a
                        href={`${API_URL}/chats/${chatId}/files/${file}?token=${token}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontFamily: vb.ffBody,
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          background: vb.black,
                          color: vb.white,
                          border: `2px solid ${vb.black}`,
                          padding: '6px 14px',
                          textDecoration: 'none',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.target.style.background = vb.red; e.target.style.borderColor = vb.red; }}
                        onMouseLeave={e => { e.target.style.background = vb.black; e.target.style.borderColor = vb.black; }}
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontFamily: vb.ffBody, fontSize: 14, color: vb.textTertiary }}>No files generated.</p>
              )}
            </div>
          )}

          {activeTab === 'steps' && (
            <div>
              {data.list_of_steps_you_did && data.list_of_steps_you_did.length > 0 ? (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {data.list_of_steps_you_did.map((step, idx) => (
                    <li key={idx} style={{
                      fontFamily: vb.ffBody,
                      fontSize: 14,
                      lineHeight: 1.6,
                      padding: '8px 0',
                      borderBottom: idx < data.list_of_steps_you_did.length - 1 ? `1px solid ${vb.borderSubtle}` : 'none',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        background: vb.red,
                        marginRight: '12px',
                      }} />
                      {step}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontFamily: vb.ffBody, fontSize: 14, color: vb.textTertiary }}>No steps recorded.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentResponse;
