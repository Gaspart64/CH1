/**
 * Handle PGN file upload from user's device
 */
function handlePGNFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.warn('No file selected');
        return;
    }
    
    // Check file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`File is too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
    }
    
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.pgn')) {
        alert('Please select a valid PGN file (.pgn)');
        return;
    }
    
    const reader = new FileReader();
    reader.onerror = () => {
        alert(`Error reading file: ${reader.error}`);
        console.error('File read error:', reader.error);
    };
    
    reader.onload = (e) => {
        try {
            const pgnContent = e.target.result;
            if (!pgnContent || pgnContent.trim().length === 0) {
                alert('File is empty. Please select a valid PGN file.');
                return;
            }
            
            // Store the PGN content
            window.uploadedPGNContent = pgnContent;
            window.uploadedPGNFileName = file.name;
            
            // Parse the PGN content
            parsePGN(pgnContent);
            
            if (!puzzleset || puzzleset.length === 0) {
                alert('No valid puzzles found in the PGN file.');
                return;
            }
            
            // Update the dropdown
            const dropdown = document.getElementById('openPGN');
            if (dropdown) {
                const existingOption = Array.from(dropdown.options).find(opt => opt.value === 'uploaded');
                if (existingOption) {
                    dropdown.removeChild(existingOption);
                }
                
                const option = document.createElement('option');
                option.value = 'uploaded';
                option.textContent = `📤 ${file.name}`;
                option.selected = true;
                dropdown.appendChild(option);
            }
            
            alert(`✓ Loaded: ${file.name}\n${puzzleset.length} puzzles found`);
            console.log(`Successfully loaded ${puzzleset.length} puzzles from ${file.name}`);
        } catch (err) {
            alert(`Error parsing PGN file: ${err.message}`);
            console.error('PGN Parse Error:', err);
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}
