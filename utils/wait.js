// Resolves after `ms` milliseconds.
function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = wait;
