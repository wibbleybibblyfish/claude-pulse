use chrono::{DateTime, Utc};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::hooks::HookEvent;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PulseState {
    Idle,
    Thinking,
    Working,
    Spawning,
    Error,
    Waiting,
}

#[derive(Debug, Clone, Serialize)]
pub struct PulseStatus {
    pub state: PulseState,
    pub intensity: f64,
    pub active_agents: u32,
    pub tool_rate: f64,
    pub port: u16,
    pub current_tool: Option<String>,
    pub session_id: Option<String>,
    pub project: Option<String>,
    pub branch: Option<String>,
    pub updated_at: DateTime<Utc>,
    pub session_started_at: Option<DateTime<Utc>>,
}

struct ToolEvent {
    timestamp: DateTime<Utc>,
}

pub struct StateMachine {
    state: PulseState,
    port: u16,
    active_agents: u32,
    active_tools: u32,
    current_tool: Option<String>,
    session_id: Option<String>,
    project: Option<String>,
    branch: Option<String>,
    last_event_at: DateTime<Utc>,
    session_started_at: Option<DateTime<Utc>>,
    error_at: Option<DateTime<Utc>>,
    tool_events: VecDeque<ToolEvent>,
    intensity_window_secs: i64,
    idle_timeout_secs: i64,
}

impl StateMachine {
    pub fn new(port: u16) -> Self {
        Self {
            state: PulseState::Idle,
            port,
            active_agents: 0,
            active_tools: 0,
            current_tool: None,
            session_id: None,
            project: None,
            branch: None,
            last_event_at: Utc::now(),
            session_started_at: None,
            error_at: None,
            tool_events: VecDeque::new(),
            intensity_window_secs: 60,
            idle_timeout_secs: 30,
        }
    }

    pub fn process_event(&mut self, event: &HookEvent) {
        let now = Utc::now();
        self.last_event_at = now;

        if let Some(sid) = &event.session_id {
            self.session_id = Some(sid.clone());
        }
        if let Some(proj) = event.project_name() {
            self.project = Some(proj);
        }

        match event.hook_event_name.as_str() {
            "SessionStart" => {
                self.session_started_at = Some(now);
                self.state = PulseState::Idle;
                self.active_agents = 0;
                self.active_tools = 0;
            }
            "SessionEnd" => {
                self.state = PulseState::Idle;
                self.active_agents = 0;
                self.active_tools = 0;
                self.session_started_at = None;
            }
            "Notification" => {
                self.state = PulseState::Waiting;
            }
            "UserPromptSubmit" => {
                self.state = PulseState::Thinking;
            }
            "PreToolUse" => {
                self.active_tools += 1;
                self.current_tool = event.tool_name.clone();
                self.tool_events.push_back(ToolEvent { timestamp: now });

                if self.active_agents > 0 {
                    self.state = PulseState::Spawning;
                } else {
                    self.state = PulseState::Working;
                }
            }
            "PostToolUse" => {
                self.active_tools = self.active_tools.saturating_sub(1);
                if self.active_tools == 0 && self.active_agents == 0 {
                    self.current_tool = None;
                }
            }
            "PostToolUseFailure" => {
                self.active_tools = self.active_tools.saturating_sub(1);
                self.error_at = Some(now);
                self.state = PulseState::Error;
            }
            "SubagentStart" => {
                self.active_agents += 1;
                self.state = PulseState::Spawning;
            }
            "SubagentStop" => {
                self.active_agents = self.active_agents.saturating_sub(1);
                if self.active_agents == 0 {
                    if self.active_tools > 0 {
                        self.state = PulseState::Working;
                    } else {
                        self.state = PulseState::Thinking;
                    }
                }
            }
            "Stop" => {
                if self.active_agents == 0 && self.active_tools == 0 {
                    self.state = PulseState::Thinking;
                }
            }
            _ => {}
        }
    }

    pub fn tick(&mut self) {
        let now = Utc::now();
        let elapsed = (now - self.last_event_at).num_seconds();

        // Error state decays after 5 seconds
        if self.state == PulseState::Error {
            if let Some(err_at) = self.error_at {
                if (now - err_at).num_seconds() >= 5 {
                    self.error_at = None;
                    if self.active_agents > 0 {
                        self.state = PulseState::Spawning;
                    } else if self.active_tools > 0 {
                        self.state = PulseState::Working;
                    } else {
                        self.state = PulseState::Idle;
                    }
                }
            }
        }

        // Idle timeout
        if elapsed >= self.idle_timeout_secs && self.state != PulseState::Idle {
            if self.state != PulseState::Error {
                self.state = PulseState::Idle;
                self.active_agents = 0;
                self.active_tools = 0;
                self.current_tool = None;
            }
        }

        // Prune old tool events outside the intensity window
        let cutoff = now - chrono::Duration::seconds(self.intensity_window_secs);
        while let Some(front) = self.tool_events.front() {
            if front.timestamp < cutoff {
                self.tool_events.pop_front();
            } else {
                break;
            }
        }
    }

    fn tool_rate(&self) -> f64 {
        self.tool_events.len() as f64
    }

    fn intensity(&self) -> f64 {
        let tool_component = (self.tool_rate() / 20.0) * 0.5;
        let agent_component = (self.active_agents as f64 / 5.0) * 0.5;
        (tool_component + agent_component).min(1.0)
    }

    pub fn status(&self) -> PulseStatus {
        PulseStatus {
            state: self.state,
            intensity: self.intensity(),
            active_agents: self.active_agents,
            tool_rate: self.tool_rate(),
            port: self.port,
            current_tool: self.current_tool.clone(),
            session_id: self.session_id.clone(),
            project: self.project.clone(),
            branch: self.branch.clone(),
            updated_at: Utc::now(),
            session_started_at: self.session_started_at,
        }
    }
}

pub type SharedState = Arc<Mutex<StateMachine>>;

pub fn new_shared_state(port: u16) -> SharedState {
    Arc::new(Mutex::new(StateMachine::new(port)))
}
