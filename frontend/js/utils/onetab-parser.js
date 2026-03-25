const OnetabParser = (() => {
    // Frontend-side OneTab text parsing (backup if backend unavailable)
    function parse(text) {
        if (!text || !text.trim()) return [];
        return text.trim().split('\n').filter(line => line.trim()).map((line, idx) => {
            const parts = line.split('|').map(s => s.trim());
            const url = parts[0] || '';
            const title = parts[1] || url;
            return { temp_id: idx, url, title, tags: [], category: '' };
        });
    }

    return { parse };
})();
