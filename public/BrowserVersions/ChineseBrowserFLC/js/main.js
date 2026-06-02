    // Listen for unlock command from parent wrapper page
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'flc_unlock_audio') {
            unlockAudio(); // Trigger the local unlock function!
        }
    });