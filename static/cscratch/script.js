let scenarios = [];

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const thread_id_from_url = urlParams.get('thread_id');
    if (thread_id_from_url) {
        sessionStorage.setItem('thread_id', thread_id_from_url);
    }

    loadScenarios();
    document.getElementById('msg').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            send();
        }
    });

    document.getElementById('scenario-select').addEventListener('change', function() {
        updateScenario();
        resetThread();
    });
});

function resetThread() {
    sessionStorage.removeItem('thread_id');
    document.getElementById('history').innerHTML = '';
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:newUrl}, '', newUrl);
}

async function loadScenarios() {
    try {
        const response = await fetch('https://cscratch-171510694317.us-central1.run.app/scenarios');
        if (!response.ok) {
            throw new Error(`Failed to load scenarios: ${response.status}`);
        }
        scenarios = await response.json();

        const select = document.getElementById('scenario-select');
        select.innerHTML = ''; // Clear existing options

        scenarios.forEach(scenario => {
            const option = document.createElement('option');
            option.value = scenario.id;
            option.textContent = scenario.displayName;
            select.appendChild(option);
        });

        // Set initial scenario
        if (scenarios.length > 0) {
            select.value = scenarios[0].id;
            updateScenario();
        }
    } catch (err) {
        console.error("Failed to load scenarios:", err);
        // Maybe show an error to the user in the UI
    }
}

function updateScenario() {
    const select = document.getElementById('scenario-select');
    const selectedScenarioId = select.value;
    const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

    if (selectedScenario) {
        document.getElementById('agent-title').textContent = selectedScenario.displayName;
        document.getElementById('msg').placeholder = selectedScenario.placeholderText;
    }
}

async function send() {
    const input = document.getElementById('msg');
    const history = document.getElementById('history');
    const select = document.getElementById('scenario-select');
    const txt = input.value;
    const scenario = select.value;

    if (!txt) return;

    // 1. Show User Message
    history.innerHTML += `<div class="user">You: ${txt}</div>`;
    input.value = '';

    // Get or create a thread_id
    let thread_id = sessionStorage.getItem('thread_id');
    if (!thread_id) {
        thread_id = crypto.randomUUID();
        sessionStorage.setItem('thread_id', thread_id);
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?thread_id=' + thread_id;
        window.history.pushState({path:newUrl}, '', newUrl);
    }

    const payload = {
        message: txt,
        thread_id: thread_id,
        scenario: scenario
    };

    const aiResponseDiv = document.createElement('div');
    aiResponseDiv.className = 'ai';
    const selectedScenario = scenarios.find(s => s.id === scenario);
    const agentName = selectedScenario ? selectedScenario.displayName : 'Gemini';
    aiResponseDiv.textContent = `${agentName}: `;
    history.appendChild(aiResponseDiv);
    history.scrollTop = history.scrollHeight;

    function showError(message) {
        aiResponseDiv.innerHTML += `<span style="color:red">${message}</span><br/>`;
        history.scrollTop = history.scrollHeight;
    }

    try {
        const response = await fetch('https://cscratch-171510694317.us-central1.run.app/stream-chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorText = `Server error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorText = errorData.detail || JSON.stringify(errorData);
            } catch (e) {
                // Ignore if response is not JSON
            }
            throw new Error(errorText);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Keep the last partial line

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const data = JSON.parse(jsonStr);

                        if (data.thread_id) {
                            sessionStorage.setItem('thread_id', data.thread_id);
                        }

                        if (data.token) {
                            const span = document.createElement('span');
                            span.textContent = data.token;
                            aiResponseDiv.appendChild(span);
                            history.scrollTop = history.scrollHeight;
                        }
                    } catch (e) {
                        showError(`Error parsing server data: ${e.message}`);
                    }
                }
            }
        }
        aiResponseDiv.innerHTML += '<br/>';

    } catch (err) {
        console.error("Fetch failed:", err);
        showError(`Error: ${err.message}`);
    }
}
