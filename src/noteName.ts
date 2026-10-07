// fill in a name template for new notes with VS Code's snippet date and time variables, like
// ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}; $CURRENT_YEAR works too, and other text is kept as typed
export function expandNameTemplate(template: string, date: Date, locale: string = 'en'): string {
	const pad = (value: number, length: number = 2) => String(value).padStart(length, '0');
	const name = (options: Intl.DateTimeFormatOptions) => date.toLocaleString(locale, options);
	const offset = -date.getTimezoneOffset();
	const variables: Record<string, () => string> = {
		CURRENT_YEAR: () => String(date.getFullYear()),
		CURRENT_YEAR_SHORT: () => String(date.getFullYear()).slice(-2),
		CURRENT_MONTH: () => pad(date.getMonth() + 1),
		CURRENT_MONTH_NAME: () => name({ month: 'long' }),
		CURRENT_MONTH_NAME_SHORT: () => name({ month: 'short' }),
		CURRENT_DATE: () => pad(date.getDate()),
		CURRENT_DAY_NAME: () => name({ weekday: 'long' }),
		CURRENT_DAY_NAME_SHORT: () => name({ weekday: 'short' }),
		CURRENT_HOUR: () => pad(date.getHours()),
		CURRENT_MINUTE: () => pad(date.getMinutes()),
		CURRENT_SECOND: () => pad(date.getSeconds()),
		CURRENT_MILLISECOND: () => pad(date.getMilliseconds(), 3),
		CURRENT_SECONDS_UNIX: () => String(Math.floor(date.getTime() / 1000)),
		CURRENT_MILLISECONDS_UNIX: () => String(date.getTime()),
		CURRENT_TIMEZONE_OFFSET: () => `${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`,
		CURRENT_TIMEZONE_NAME: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
	};
	return template.replace(/\$\{([A-Z_]+)\}|\$([A-Z_]+)/g, (match, braced: string | undefined, bare: string | undefined) => {
		const variable = variables[braced ?? bare ?? ''];
		return variable ? variable() : match;
	});
}
