/** French number display: decimal comma ("5,5"). Inputs accept both "," and ".". */
export const fr = (n: number): string => String(n).replace('.', ',')
