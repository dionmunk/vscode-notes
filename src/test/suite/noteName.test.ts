import * as assert from 'assert';
import { expandNameTemplate } from '../../noteName';

suite('New Note Name (#61)', () => {
	// Wednesday 7 October 2026, 09:05:03.042 local time
	const date = new Date(2026, 9, 7, 9, 5, 3, 42);

	test('date and time variables are filled in, two digits each', () => {
		assert.strictEqual(expandNameTemplate('${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE} ${CURRENT_HOUR}-${CURRENT_MINUTE}-${CURRENT_SECOND}', date), '2026-10-07 09-05-03');
	});

	test('the short year and the milliseconds', () => {
		assert.strictEqual(expandNameTemplate('${CURRENT_YEAR_SHORT}.${CURRENT_MILLISECOND}', date), '26.042');
	});

	test('month and day names', () => {
		assert.strictEqual(expandNameTemplate('${CURRENT_DAY_NAME} ${CURRENT_DATE} ${CURRENT_MONTH_NAME}', date), 'Wednesday 07 October');
		assert.strictEqual(expandNameTemplate('${CURRENT_DAY_NAME_SHORT} ${CURRENT_MONTH_NAME_SHORT}', date), 'Wed Oct');
	});

	test('variables without braces work too, and the longest name wins', () => {
		assert.strictEqual(expandNameTemplate('$CURRENT_YEAR_SHORT$CURRENT_MONTH notes', date), '2610 notes');
	});

	test('unix time', () => {
		assert.strictEqual(expandNameTemplate('${CURRENT_SECONDS_UNIX}', date), String(Math.floor(date.getTime() / 1000)));
	});

	test('other text and unknown variables are kept as typed', () => {
		assert.strictEqual(expandNameTemplate('Meeting ${CURRENT_DATE} with $client ${NOT_A_VARIABLE}', date), 'Meeting 07 with $client ${NOT_A_VARIABLE}');
		assert.strictEqual(expandNameTemplate('', date), '');
	});
});
