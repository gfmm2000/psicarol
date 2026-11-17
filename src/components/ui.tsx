import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div>{action}</div>
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section> }
export function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:opacity-50 ${className}`} {...props}>{children}</button> }
export function Status({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) { const colors = { neutral: 'bg-slate-100 text-slate-700', success: 'bg-emerald-50 text-emerald-700', warning: 'bg-amber-50 text-amber-700' }; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>{children}</span> }
