/**
 * Rounds a number to the nearest step value while respecting min/max bounds
 * @param {number} value - The number to round
 * @param {number} step - The step size to round to
 * @param {number} [min=-Infinity] - Minimum allowed value
 * @param {number} [max=Infinity] - Maximum allowed value
 * @returns {number} The rounded value within bounds
 */
export function roundToStep (value, step, min = -Infinity, max = Infinity) {
  if (step === 0) return Math.max(min, Math.min(max, value))

  const rounded = Math.round(value / step) * step
  const stepStr = step.toString()
  const precision = stepStr.includes('.') ? stepStr.split('.')[1].length : 0
  const result = parseFloat(rounded.toFixed(precision))

  return Math.max(min, Math.min(max, result))
}
