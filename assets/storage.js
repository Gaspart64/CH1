function saveProgress(setIndex) {
    localStorage.setItem("repetitionSetIndex", setIndex.toString());
}

function loadProgress() {
    const val = localStorage.getItem("repetitionSetIndex");
    return val ? parseInt(val) : 0;
}

function clearProgress() {
    localStorage.removeItem("repetitionSetIndex");
}
