const { createClient } = require('@supabase/supabase-js');
const { compactOldVotes } = require('./compact-utils');

const supabase = createClient(
    'https://bazcoiuhgbgyyhfggjhv.supabase.co',
    'sb_publishable_5AIk0L_JevietDyF9_7w1w_oHBLmIO9'
);

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
