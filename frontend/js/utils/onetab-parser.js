const OnetabParser = (() => {
    const FACTORY_TAG_RE = /f\d+[a-z]?/gi;

    function detectFactoryTags(url, title) {
        const text = `${url} ${title}`;
        const matches = text.match(FACTORY_TAG_RE) || [];
        const seen = new Set();
        return matches
            .map(m => m.toLowerCase())
            .filter(m => { if (seen.has(m)) return false; seen.add(m); return true; });
    }

    function parse(text) {
        if (!text || !text.trim()) return [];
        return text.trim().split('\n').filter(line => line.trim()).map((line, idx) => {
            const parts = line.split('|').map(s => s.trim());
            const url = parts[0] || '';
            const title = parts[1] || url;
            const tags = detectFactoryTags(url, title);
            return { temp_id: idx, url, title, tags, category: '' };
        });
    }

    return { parse };
})();
