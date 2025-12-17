const API_BASE_URL = 'https://cscratch-171510694317.us-central1.run.app';
let stories = [];
let currentGameId = null;

document.addEventListener('DOMContentLoaded', function() {
    loadStories();
    document.getElementById('msg').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            send();
        }
    });

    document.getElementById('story-select').addEventListener('change', function() {
        updateStory();
        resetGame();
    });
});

function resetGame() {
    sessionStorage.removeItem('game_id');
    currentGameId = null;
    document.getElementById('history').innerHTML = '';
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:newUrl}, '', newUrl);
}

async function loadStories() {
    try {
        const response = await fetch(`${API_BASE_URL}/stories/`, { cache: 'reload' });
        if (!response.ok) {
            throw new Error(`Failed to load stories: ${response.status}`);
        }
        stories = await response.json();

        const select = document.getElementById('story-select');
        select.innerHTML = ''; // Clear existing options

        stories.forEach(story => {
            const option = document.createElement('option');
            option.value = story.id;
            option.textContent = story.displayName;
            select.appendChild(option);
        });

        if (stories.length > 0) {
            select.value = stories[0].id;
            updateStory();
        }
    } catch (err) {
        console.error("Failed to load stories:", err);
    }
}

function updateStory() {
    const select = document.getElementById('story-select');
    const selectedStoryId = select.value;
    const selectedStory = stories.find(s => s.id === selectedStoryId);

    if (selectedStory) {
        document.getElementById('agent-title').textContent = selectedStory.displayName;
        document.getElementById('msg').placeholder = selectedStory.placeholderText;
    }
}

async function send() {
    const input = document.getElementById('msg');
    const history = document.getElementById('history');
    const select = document.getElementById('story-select');
    const txt = input.value;
    const story_id = select.value;

    if (!txt) return;

    history.innerHTML += `<div class="user">You: ${txt}</div>`;
    input.value = '';

    if (!currentGameId) {
        currentGameId = crypto.randomUUID();
        sessionStorage.setItem('game_id', currentGameId);
    }

    const payload = {
        message: txt
    };

    const aiResponseDiv = document.createElement('div');
    aiResponseDiv.className = 'ai';
    const selectedStory = stories.find(s => s.id === story_id);
    const agentName = selectedStory ? selectedStory.displayName : 'Gemini';
    aiResponseDiv.textContent = `${agentName}: `;
    history.appendChild(aiResponseDiv);
    history.scrollTop = history.scrollHeight;

    function showError(message) {
        aiResponseDiv.innerHTML += `<span style="color:red">${message}</span><br/>`;
        history.scrollTop = history.scrollHeight;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/stories/${story_id}/games/${currentGameId}/chat`, {
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
            buffer = lines.pop(); 

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const data = JSON.parse(jsonStr);

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
