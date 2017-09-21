const filbert = require('./filbert');
const filbert_loose = require('./filbert_loose');

filbert.parse_dammit = filbert_loose.parse_dammit;
module.exports = filbert;
