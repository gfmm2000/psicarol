const euroFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
export const formatEuro = (cents: number) => euroFormatter.format(cents / 100)
