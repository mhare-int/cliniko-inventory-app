# User Behavior Analytics System

## Overview
A comprehensive user behavior tracking system that logs user interactions to enable personalized UI experiences and AI-driven insights.

## Features Implemented

### 1. Database Schema
- **user_behavior_log**: Tracks individual user actions with context
- **user_sessions**: Manages user session data and analytics
- **user_preferences**: Stores user customization preferences

### 2. Backend Functions
- `startUserSession()` - Initialize session tracking
- `endUserSession()` - Close session with duration calculation
- `logUserBehavior()` - Log specific user interactions
- `setUserPreference()` / `getUserPreferences()` - Manage user customizations
- `getUserBehaviorAnalytics()` - Generate individual user insights
- `getAllUsersBehaviorInsights()` - Admin overview of all users

### 3. Frontend Tracking Hook
**`useBehaviorTracking`** - React hook that automatically tracks:
- Page views and time spent
- Feature usage
- Button clicks
- Form submissions
- Search/filter actions
- Task completion times
- User preferences

### 4. Analytics Dashboard
**User Behavior Analytics** page accessible at `/admin/behavior-analytics`:
- All users overview with engagement metrics
- Individual user detailed analytics
- Session statistics (duration, page views, actions)
- Feature usage frequency and duration
- Most visited pages
- Customizable time periods (7, 30, 90, 365 days)

## Data Tracked

### User Actions
- `page_view` - Page navigation with time spent
- `feature_use` - Specific feature interactions
- `click` - Button/element clicks
- `form_submit` - Form submissions
- `search` - Search and filter operations
- `task_complete` - Completed workflows
- `customization` - User preference changes

### Context Metadata
- User agent and device info
- Screen resolution and viewport
- Timestamps
- Action-specific data (search terms, form fields, etc.)

### Session Data
- Session duration
- Page views per session
- Actions per session
- Last activity timestamp

## Usage Examples

### In React Components
```javascript
import { useBehaviorTracking } from './hooks/useBehaviorTracking';

const MyComponent = ({ user }) => {
  const behaviorTracking = useBehaviorTracking(user);
  
  const handleFeatureUse = () => {
    behaviorTracking.trackFeatureUse('my_feature', { 
      action: 'button_click',
      context: 'additional_data'
    });
  };
  
  const handleSearch = (term) => {
    behaviorTracking.trackSearch(term, resultsCount);
  };
};
```

### Backend Analytics
```javascript
// Get user insights for last 30 days
const analytics = await db.getUserBehaviorAnalytics(userId, 30);

// Get all users overview
const insights = await db.getAllUsersBehaviorInsights(30);
```

## Privacy & Security
- No personally identifiable content is logged
- Search terms are truncated if too long
- Only actionable behavioral patterns are tracked
- Session data is anonymized after user logout

## Future Applications

### Personalization
- Adaptive UI based on usage patterns
- Customized navigation shortcuts
- Feature recommendations
- Optimized workflows

### AI Integration
- Feed behavioral data to ML models
- Predict user needs and preferences
- Automated UI adaptations
- Intelligent feature suggestions

### Business Intelligence
- Feature adoption rates
- User engagement patterns
- Performance bottlenecks
- Usage trend analysis

## Getting Started

1. The system automatically tracks basic interactions when users are logged in
2. Access analytics via the "User Analytics" tab (admin only)
3. Use the `useBehaviorTracking` hook in components for custom tracking
4. Query the database directly for advanced analytics

## Database Tables

### user_behavior_log
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| session_id | TEXT | Session identifier |
| action_type | TEXT | Type of action (page_view, click, etc.) |
| feature_accessed | TEXT | Feature/page name |
| page_url | TEXT | Current page URL |
| timestamp | TEXT | ISO timestamp |
| duration_ms | INTEGER | Time spent on action |
| metadata_json | TEXT | Additional context data |

### user_sessions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| session_id | TEXT | Unique session ID |
| start_time | TEXT | Session start timestamp |
| end_time | TEXT | Session end timestamp |
| total_duration_ms | INTEGER | Total session duration |
| page_views | INTEGER | Pages visited in session |
| actions_count | INTEGER | Total actions in session |
| last_activity | TEXT | Last activity timestamp |

### user_preferences
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| preference_key | TEXT | Preference identifier |
| preference_value | TEXT | Preference value |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

This system provides a foundation for building intelligent, adaptive user experiences while maintaining privacy and security standards.
