const FuzzySearch = (() => {
    function match(query, text) {
        if (!query) return { match: true, score: 0 };
        const q = query.toLowerCase();
        const t = text.toLowerCase();

        // Exact substring match scores highest
        if (t.includes(q)) {
            const idx = t.indexOf(q);
            return { match: true, score: 100 - idx };
        }

        // Fuzzy: all chars of query appear in order
        let qi = 0;
        let score = 0;
        let lastIdx = -1;
        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
            if (t[ti] === q[qi]) {
                score += (ti === lastIdx + 1) ? 10 : 1; // consecutive chars score higher
                lastIdx = ti;
                qi++;
            }
        }

        if (qi === q.length) {
            return { match: true, score };
        }
        return { match: false, score: 0 };
    }

    function filter(query, items, keys) {
        if (!query) return items;
        return items
            .map(item => {
                let bestScore = 0;
                for (const key of keys) {
                    const val = typeof key === 'function' ? key(item) : item[key];
                    if (val) {
                        const result = match(query, String(val));
                        if (result.match && result.score > bestScore) {
                            bestScore = result.score;
                        }
                    }
                }
                return { item, score: bestScore };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(r => r.item);
    }

    return { match, filter };
})();
