const API_BASE_URL = 'https://cscratch-171510694317.us-central1.run.app';
let stories = [];
let currentGameId = null;
let selectedStory = null;

document.addEventListener('DOMContentLoaded', function() {
    loadStories().then(() => {
        handleUrl();
        window.onpopstate = handleUrl; // Handle browser back/forward buttons
    });

    document.getElementById('msg').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            send();
        }
    });

    document.getElementById('new-chat-button').addEventListener('click', function() {
        // Go back to story selection
        history.pushState({}, '', '/cscratch/stories/');
        handleUrl();
    });
});

function handleUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/cscratch\/stories\/([^\/]+)(?:\/threads\/([^\/]+))?/);

    if (match && match[1]) {
        const storyId = match[1];
        const threadId = match[2];

        // Find the story
        const story = stories.find(s => s.id === storyId);
        if (story) {
            selectStory(story, false); // select the story without resetting the game
            if (threadId && threadId !== currentGameId) {
                currentGameId = threadId;
                sessionStorage.setItem('game_id', currentGameId);
                // Here you would typically load the chat history for this thread
                // For this demo, we\'ll just clear the history.
                document.getElementById('history').innerHTML = '';

            } else if (!threadId) {
                // If there\'s no threadId in the URL, we\'re starting a new chat
                resetGame(false); // don't update URL, as it's already correct
            }
        } else {
            // Story not found, go to story selection
            history.replaceState({}, '', '/cscratch/stories/');
            showStorySelection();
        }
    } else {
        // Show the story selection view if the URL doesn't match
        showStorySelection();
    }
}


function showStorySelection() {
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('story-selection-view').style.display = 'flex';
    selectedStory = null;
    currentGameId = null;
    sessionStorage.removeItem('game_id');
}


function updateUrl() {
    if (!selectedStory) {
        history.pushState({}, '', '/cscratch/stories/');
        return;
    }

    let newUrl = `/cscratch/stories/${selectedStory.id}`;
    if (currentGameId) {
        newUrl += `/threads/${currentGameId}`;
    }
    // Use pushState to update the URL with a new entry in the browser's history
    history.pushState({path: newUrl}, '', newUrl);
}

function resetGame(shouldUpdateUrl = true) {
    sessionStorage.removeItem('game_id');
    currentGameId = null;
    document.getElementById('history').innerHTML = '';
    if (shouldUpdateUrl) {
        updateUrl();
    }
}

async function loadStories() {
    try {
        const response = await fetch(`${API_BASE_URL}/stories/`, { cache: 'reload' });
        if (!response.ok) {
            throw new Error(`Failed to load stories: ${response.status}`);
        }
        stories = await response.json();

        const storyList = document.getElementById('story-list');
        storyList.innerHTML = ''; // Clear existing stories

        stories.forEach(story => {
            const storyElement = document.createElement('div');
            storyElement.className = 'story';
            storyElement.innerHTML = `
                <h3>${story.displayName}</h3>
                <p>${story.description}</p>
            `;
            storyElement.addEventListener('click', () => {
                // When a story is clicked, navigate to its URL
                history.pushState({}, '', `/cscratch/stories/${story.id}`);
                handleUrl();
            });
            storyList.appendChild(storyElement);
        });

    } catch (err) {
        console.error("Failed to load stories:", err);
    }
}

function selectStory(story, doResetGame = true) {
    selectedStory = story;
    document.getElementById('agent-title').textContent = selectedStory.displayName;
    document.getElementById('msg').placeholder = selectedStory.placeholderText;
    document.getElementById('story-selection-view').style.display = 'none';
    document.getElementById('chat-view').style.display = 'flex'; // Use flex as per corrected CSS
    if (doResetGame) {
        resetGame();
    }
    // URL is now managed by handleUrl and clicks, so we don't need to call updateUrl here
}


async function send() {
    const input = document.getElementById('msg');
    const history = document.getElementById('history');
    const txt = input.value;

    if (!txt || !selectedStory) return;
    const story_id = selectedStory.id;


    history.innerHTML += `<div class="user">You: ${txt}</div>`;
    input.value = '';

    if (!currentGameId) {
        currentGameId = crypto.randomUUID();
        sessionStorage.setItem('game_id', currentGameId);
        updateUrl(); // Update URL with the new thread-id
    }

    const payload = {
        message: txt
    };

    const aiResponseDiv = document.createElement('div');
    aiResponseDiv.className = 'ai';
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
            if (done) break;

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
