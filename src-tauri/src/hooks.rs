use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct HookEvent {
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    pub hook_event_name: String,
    pub tool_name: Option<String>,
    pub tool_input: Option<serde_json::Value>,
    pub agent_id: Option<String>,
    pub agent_type: Option<String>,
}

impl HookEvent {
    pub fn project_name(&self) -> Option<String> {
        self.cwd.as_ref().and_then(|cwd| {
            cwd.split('/').last().map(|s| s.to_string())
        })
    }
}
