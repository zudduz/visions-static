document.addEventListener('DOMContentLoaded', () => {
            const generateBtn = document.getElementById('generate-btn');
            const visionDisplay = document.getElementById('vision-display');
            const visionImage = document.getElementById('vision-image');
            const visionText = document.getElementById('vision-text');
            const originalButtonText = generateBtn.textContent;

            generateBtn.addEventListener('click', async () => {
                generateBtn.disabled = true;
                generateBtn.textContent = 'Generating';
                generateBtn.classList.add('loading');
                visionDisplay.classList.add('hidden');

                try {
                    const response = await fetch('https://visions-cloud-run-171510694317.us-central1.run.app/vision', {
                        method: 'POST'
                    });
                    if (!response.ok) {
                        throw new Error(`Network response was not ok: ${response.statusText}`);
                    }
                    const data = await response.json(); // Expects { "image": "url", "text": "string" }

                    if (data.image) {
                        visionImage.src = data.image;
                        visionImage.style.display = 'block';
                    } else {
                        visionImage.style.display = 'none';
                    }

                    if (data.text) {
                        visionText.textContent = data.text;
                    } else {
                        visionText.textContent = '';
                    }
                    
                    visionDisplay.classList.remove('hidden');
                } catch (error) {
                    console.error('Error fetching vision:', error);
                    visionText.textContent = 'Sorry, a vision could not be generated at this time. Please try again later.';
                    visionImage.src = ''; // Clear image on error
                    visionDisplay.classList.remove('hidden');
                } finally {
                    generateBtn.disabled = false;
                    generateBtn.textContent = originalButtonText;
                    generateBtn.classList.remove('loading');
                }
            });
        });