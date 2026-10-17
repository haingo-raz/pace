export const logger = {
  info: (p: object) =>
    console.log(
      JSON.stringify({ level: 'info', at: new Date().toISOString(), ...p }),
    ),
  warn: (p: object) =>
    console.warn(
      JSON.stringify({ level: 'warn', at: new Date().toISOString(), ...p }),
    ),
  error: (p: object) =>
    console.error(
      JSON.stringify({ level: 'error', at: new Date().toISOString(), ...p }),
    ),
}
