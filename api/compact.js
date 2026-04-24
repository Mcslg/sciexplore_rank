const { compactOldVotes } = require('./compact-utils');

const supabase = require('./supabase-client');

module.exports = async (req, res) => {
    try {
        const result = await compactOldVotes(supabase, {
            full: req.query.full === 'true',
            dryRun: req.query.dryRun === 'true'
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Compact Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
