import React, { useState, useEffect } from 'react';

const UserBehaviorAnalytics = ({ user }) => {
  const [analytics, setAnalytics] = useState(null);
  const [allUsersInsights, setAllUsersInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [daysPast, setDaysPast] = useState(30);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'detailed', 'patterns'
  const [behaviorLogs, setBehaviorLogs] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId === 'all') {
      fetchAllUsersInsights();
    } else {
      fetchUserAnalytics(parseInt(selectedUserId));
    }
  }, [selectedUserId, daysPast]);

  useEffect(() => {
    if (viewMode === 'patterns' && selectedUserId !== 'all') {
      fetchBehaviorLogs(parseInt(selectedUserId));
    }
  }, [viewMode, selectedUserId, daysPast]);

  const fetchUsers = async () => {
    try {
      if (!window.api?.getAllUsers) return;
      const usersData = await window.api.getAllUsers();
      setUsers(usersData || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchBehaviorLogs = async (userId) => {
    try {
      if (!window.api?.getUserBehaviorAnalytics) return;
      const data = await window.api.getUserBehaviorAnalytics(userId, daysPast);
      if (data && data.behaviorLogs) {
        setBehaviorLogs(data.behaviorLogs);
      }
    } catch (err) {
      console.error('Error fetching behavior logs:', err);
    }
  };

  const fetchUserAnalytics = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.api?.getUserBehaviorAnalytics) {
        throw new Error('User behavior analytics API not available');
      }
      const data = await window.api.getUserBehaviorAnalytics(userId, daysPast);
      if (data.error) throw new Error(data.error);
      setAnalytics(data);
      setAllUsersInsights(null);
    } catch (err) {
      setError(err.message);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsersInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.api?.getAllUsersBehaviorInsights) {
        throw new Error('All users behavior insights API not available');
      }
      const data = await window.api.getAllUsersBehaviorInsights(daysPast);
      if (data.error) throw new Error(data.error);
      setAllUsersInsights(data);
      setAnalytics(null);
    } catch (err) {
      setError(err.message);
      setAllUsersInsights(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    return typeof num === 'number' ? num.toLocaleString() : num;
  };

  const renderAdvancedInsights = (behaviorData) => {
    if (!behaviorData || !behaviorData.metadata_json) return null;
    
    try {
      const metadata = JSON.parse(behaviorData.metadata_json);
      
      return (
        <div style={{ marginTop: '20px' }}>
          <h4 style={{ color: '#1565c0', marginBottom: '15px' }}>Advanced Behavioral Patterns</h4>
          
          {/* Frustration Indicators */}
          {metadata.indicator && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#fff3e0', 
              borderLeft: '4px solid #ff9800',
              marginBottom: '15px'
            }}>
              <strong>Frustration Indicator: </strong>
              {metadata.indicator.replace(/_/g, ' ').toUpperCase()}
              {metadata.clickCount && <span> ({metadata.clickCount} rapid clicks)</span>}
              {metadata.refinementNumber && <span> (Refinement #{metadata.refinementNumber})</span>}
            </div>
          )}
          
          {/* Performance Issues */}
          {metadata.issue && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#ffebee', 
              borderLeft: '4px solid #f44336',
              marginBottom: '15px'
            }}>
              <strong>Performance Issue: </strong>
              {metadata.issue.replace(/_/g, ' ').toUpperCase()}
              {metadata.loadTime && <span> (Load time: {formatDuration(metadata.loadTime)})</span>}
              {metadata.memoryUsage && <span> (Memory usage: {(metadata.memoryUsage * 100).toFixed(1)}%)</span>}
            </div>
          )}
          
          {/* Workflow Information */}
          {metadata.workflowName && (
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#e8f5e8', 
              borderLeft: '4px solid #4caf50',
              marginBottom: '15px'
            }}>
              <strong>Workflow: </strong>{metadata.workflowName}
              {metadata.workflowStep && <span> (Step: {metadata.workflowStep})</span>}
              {metadata.success !== undefined && (
                <span style={{ color: metadata.success ? '#4caf50' : '#f44336' }}>
                  {metadata.success ? ' ✓ Completed' : ' ✗ Failed'}
                </span>
              )}
            </div>
          )}
          
          {/* Device & Context Info */}
          {(metadata.deviceType || metadata.browserInfo) && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              {metadata.deviceType && <span>Device: {metadata.deviceType} | </span>}
              {metadata.browserInfo?.name && <span>Browser: {metadata.browserInfo.name} | </span>}
              {metadata.connectionType && <span>Connection: {metadata.connectionType} | </span>}
              {metadata.onlineStatus !== undefined && <span>Online: {metadata.onlineStatus ? 'Yes' : 'No'}</span>}
            </div>
          )}
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  const renderContent = () => {
    if (selectedUserId === 'all') {
      return renderAllUsersOverview();
    }

    switch (viewMode) {
      case 'overview':
        return renderOverview();
      case 'detailed':
        return renderDetailed();
      case 'patterns':
        return renderBehavioralPatterns();
      default:
        return renderOverview();
    }
  };

  const renderAllUsersOverview = () => {
    if (!allUsersInsights) return null;

    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>All Users Overview ({daysPast} days)</h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {allUsersInsights.userInsights.map(user => (
            <div key={user.user_id} style={{
              padding: '20px',
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>{user.username}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                <div><strong>Sessions:</strong> {formatNumber(user.sessions)}</div>
                <div><strong>Total Actions:</strong> {formatNumber(user.total_actions)}</div>
                <div><strong>Avg Duration:</strong> {formatDuration(user.avg_action_duration)}</div>
                <div><strong>Engagement Score:</strong> {user.total_actions > 0 ? Math.round((user.total_actions / Math.max(user.sessions, 1)) * 10) / 10 : 0}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Features Used:</strong> 
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    {user.features_used ? user.features_used.split(',').slice(0, 5).join(', ') : 'None'}
                    {user.features_used && user.features_used.split(',').length > 5 && '...'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    if (!analytics) return null;

    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>
          User Overview ({daysPast} days)
        </h2>

        {/* Session Statistics */}
        {analytics.sessionStats && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Session Statistics</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              fontSize: '14px'
            }}>
              <div>
                <strong>Total Sessions:</strong> {formatNumber(analytics.sessionStats.total_sessions)}
              </div>
              <div>
                <strong>Avg Session Duration:</strong> {formatDuration(analytics.sessionStats.avg_session_duration)}
              </div>
              <div>
                <strong>Avg Page Views/Session:</strong> {formatNumber(Math.round(analytics.sessionStats.avg_page_views * 10) / 10)}
              </div>
              <div>
                <strong>Avg Actions/Session:</strong> {formatNumber(Math.round(analytics.sessionStats.avg_actions_per_session * 10) / 10)}
              </div>
            </div>
          </div>
        )}

        {/* Top Features */}
        {analytics.featureUsage && analytics.featureUsage.length > 0 && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Top Features Used</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {analytics.featureUsage.slice(0, 6).map((feature, index) => (
                <div key={index} style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {feature.feature_accessed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {formatNumber(feature.usage_count)} times
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDetailed = () => {
    if (!analytics) return null;

    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>
          Detailed Analytics ({daysPast} days)
        </h2>

        {/* Session Statistics - Enhanced */}
        {analytics.sessionStats && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Session & Engagement Analytics</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              fontSize: '14px'
            }}>
              <div>
                <strong>Total Sessions:</strong> {formatNumber(analytics.sessionStats.total_sessions)}
              </div>
              <div>
                <strong>Avg Session Duration:</strong> {formatDuration(analytics.sessionStats.avg_session_duration)}
              </div>
              <div>
                <strong>Avg Page Views/Session:</strong> {formatNumber(Math.round(analytics.sessionStats.avg_page_views * 10) / 10)}
              </div>
              <div>
                <strong>Avg Actions/Session:</strong> {formatNumber(Math.round(analytics.sessionStats.avg_actions_per_session * 10) / 10)}
              </div>
              <div>
                <strong>Engagement Score:</strong> {
                  analytics.sessionStats.avg_actions_per_session > 0 
                    ? Math.round(analytics.sessionStats.avg_actions_per_session * analytics.sessionStats.avg_page_views * 10) / 10
                    : 0
                }
              </div>
              <div>
                <strong>User Type:</strong> {
                  analytics.sessionStats.avg_session_duration > 300000 ? 'Power User' :
                  analytics.sessionStats.avg_session_duration > 120000 ? 'Regular User' : 'Casual User'
                }
              </div>
            </div>
          </div>
        )}

        {/* Feature Usage with enhanced insights */}
        {analytics.featureUsage && analytics.featureUsage.length > 0 && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Feature Usage Analysis</h3>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Feature</th>
                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Usage Count</th>
                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Avg Duration</th>
                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Proficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.featureUsage.map((feature, index) => {
                    const proficiency = feature.usage_count > 10 ? 'Expert' : 
                                      feature.usage_count > 5 ? 'Intermediate' : 'Beginner';
                    const proficiencyColor = feature.usage_count > 10 ? '#4caf50' : 
                                           feature.usage_count > 5 ? '#ff9800' : '#f44336';
                    
                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {feature.feature_accessed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                          {formatNumber(feature.usage_count)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                          {formatDuration(feature.avg_duration)}
                        </td>
                        <td style={{ 
                          padding: '10px', 
                          textAlign: 'right', 
                          border: '1px solid #ddd',
                          color: proficiencyColor,
                          fontWeight: 'bold'
                        }}>
                          {proficiency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Pages with enhanced context */}
        {analytics.topPages && analytics.topPages.length > 0 && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Page Navigation Patterns</h3>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Page</th>
                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Visit Count</th>
                    <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topPages.map((page, index) => {
                    const priority = index === 0 ? 'Primary' : index < 3 ? 'Secondary' : 'Tertiary';
                    const priorityColor = index === 0 ? '#4caf50' : index < 3 ? '#ff9800' : '#757575';
                    
                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                          {page.page_url}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', border: '1px solid #ddd' }}>
                          {formatNumber(page.visit_count)}
                        </td>
                        <td style={{ 
                          padding: '10px', 
                          textAlign: 'right', 
                          border: '1px solid #ddd',
                          color: priorityColor,
                          fontWeight: 'bold'
                        }}>
                          {priority}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBehavioralPatterns = () => {
    if (!analytics) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          Please select a specific user to view behavioral patterns.
        </div>
      );
    }

    return (
      <div>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>
          Behavioral Patterns Analysis ({daysPast} days)
        </h2>

        {/* Recent Activity Stream */}
        {behaviorLogs && behaviorLogs.length > 0 && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '20px',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Recent Activity Stream</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {behaviorLogs.slice(0, 50).map((log, index) => (
                <div key={index} style={{ 
                  padding: '10px', 
                  marginBottom: '8px',
                  backgroundColor: index % 2 === 0 ? '#fafafa' : 'white',
                  borderRadius: '4px',
                  border: '1px solid #eee'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: log.action_type === 'error' ? '#f44336' :
                             log.action_type === 'frustration' ? '#ff9800' :
                             log.action_type === 'workflow' ? '#4caf50' : '#1565c0'
                    }}>
                      {log.action_type?.toUpperCase()} - {log.feature_accessed?.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                    Page: {log.page_url}
                  </div>
                  {log.duration_ms && (
                    <div style={{ fontSize: '12px', color: '#888' }}>
                      Duration: {formatDuration(log.duration_ms)}
                    </div>
                  )}
                  {renderAdvancedInsights(log)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pattern Analysis */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* User Proficiency Analysis */}
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>User Proficiency</h3>
            {analytics.featureUsage && analytics.featureUsage.length > 0 ? (
              <div>
                {analytics.featureUsage.slice(0, 5).map((feature, index) => {
                  const proficiency = feature.usage_count > 10 ? 'Expert' : 
                                    feature.usage_count > 5 ? 'Intermediate' : 'Beginner';
                  const proficiencyColor = feature.usage_count > 10 ? '#4caf50' : 
                                         feature.usage_count > 5 ? '#ff9800' : '#f44336';
                  
                  return (
                    <div key={index} style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {feature.feature_accessed.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div style={{ fontSize: '12px', color: proficiencyColor, fontWeight: 'bold' }}>
                        {proficiency} ({feature.usage_count} uses)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#666' }}>No feature usage data available</div>
            )}
          </div>

          {/* Engagement Patterns */}
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Engagement Patterns</h3>
            {analytics.sessionStats ? (
              <div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>Session Frequency</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {analytics.sessionStats.total_sessions > daysPast ? 'High' :
                     analytics.sessionStats.total_sessions > daysPast/2 ? 'Medium' : 'Low'} 
                    ({analytics.sessionStats.total_sessions} sessions in {daysPast} days)
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>Session Depth</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {analytics.sessionStats.avg_actions_per_session > 10 ? 'Deep' :
                     analytics.sessionStats.avg_actions_per_session > 5 ? 'Medium' : 'Shallow'} 
                    ({Math.round(analytics.sessionStats.avg_actions_per_session * 10) / 10} actions/session)
                  </div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>User Type</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {analytics.sessionStats.avg_session_duration > 300000 ? 'Power User' :
                     analytics.sessionStats.avg_session_duration > 120000 ? 'Regular User' : 'Casual User'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#666' }}>No session data available</div>
            )}
          </div>
        </div>

        {/* Navigation Preferences */}
        {analytics.topPages && analytics.topPages.length > 0 && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>Navigation Preferences</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              {analytics.topPages.slice(0, 4).map((page, index) => {
                const preference = index === 0 ? 'Primary Destination' : 
                                 index === 1 ? 'Secondary Choice' : 'Regular Visit';
                const preferenceColor = index === 0 ? '#4caf50' : 
                                      index === 1 ? '#ff9800' : '#757575';
                
                return (
                  <div key={index} style={{ 
                    padding: '15px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '4px',
                    border: `2px solid ${preferenceColor}`
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>
                      {page.page_url}
                    </div>
                    <div style={{ fontSize: '12px', color: preferenceColor, fontWeight: 'bold' }}>
                      {preference}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {formatNumber(page.visit_count)} visits
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading user behavior analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', color: '#333' }}>Advanced User Behavior Analytics</h1>
      
      {/* Enhanced Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>User:</label>
          <select 
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value="all">All Users Overview</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>Time Period:</label>
          <select 
            value={daysPast} 
            onChange={(e) => setDaysPast(parseInt(e.target.value))}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '14px' }}>View Mode:</label>
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value="overview">Overview</option>
            <option value="detailed">Detailed Analysis</option>
            <option value="patterns">Behavioral Patterns</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #ffcdd2'
        }}>
          Error: {error}
        </div>
      )}

      {/* Render content based on view mode */}
      {renderContent()}
    </div>
  );
};

export default UserBehaviorAnalytics;
