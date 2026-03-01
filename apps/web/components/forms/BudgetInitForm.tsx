'use client'

import { useState } from 'react'

import type { ExpenseCategory } from '@lifebalance/shared/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface BudgetInitFormProps {
  yearMonth: string
  onSave: (payload: {
    year_month: string
    budgets: Array<{ category: string; limit_amount: number; is_fixed: boolean }>
  }) => Promise<unknown>
  isSaving?: boolean
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'housing',
  'food',
  'transport',
  'entertainment',
  'clothing',
  'communication',
  'medical',
  'social',
  'other',
]

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  housing: '住居費',
  food: '食費',
  transport: '交通費',
  entertainment: '娯楽',
  clothing: '衣類',
  communication: '通信',
  medical: '医療',
  social: '交際費',
  other: 'その他',
}

const FIXED_BY_DEFAULT = new Set<ExpenseCategory>(['housing', 'communication'])

function formatAmountInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return ''
  return Number(digitsOnly).toLocaleString('ja-JP')
}

export function BudgetInitForm({ yearMonth, onSave, isSaving = false }: BudgetInitFormProps) {
  const [amounts, setAmounts] = useState<Record<ExpenseCategory, number>>(
    Object.fromEntries(EXPENSE_CATEGORIES.map((cat) => [cat, 0])) as Record<ExpenseCategory, number>,
  )
  const [inputs, setInputs] = useState<Record<ExpenseCategory, string>>(
    Object.fromEntries(EXPENSE_CATEGORIES.map((cat) => [cat, ''])) as Record<ExpenseCategory, string>,
  )
  const [isFixed, setIsFixed] = useState<Record<ExpenseCategory, boolean>>(
    Object.fromEntries(
      EXPENSE_CATEGORIES.map((cat) => [cat, FIXED_BY_DEFAULT.has(cat)]),
    ) as Record<ExpenseCategory, boolean>,
  )

  const handleSave = async () => {
    const budgets = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      limit_amount: amounts[cat],
      is_fixed: isFixed[cat],
    }))
    await onSave({ year_month: yearMonth, budgets })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text2">各カテゴリの月次予算を入力してください。</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EXPENSE_CATEGORIES.map((cat) => (
          <Card key={cat} className="border-border bg-card">
            <CardHeader className="space-y-3 pb-1">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-accent">{CATEGORY_LABELS[cat]}</CardTitle>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-text2">
                  {isFixed[cat] ? '固定費' : '変動費'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="例: 50,000"
                value={inputs[cat]}
                onChange={(e) => {
                  const formatted = formatAmountInput(e.target.value)
                  setInputs((prev) => ({ ...prev, [cat]: formatted }))
                  const raw = formatted.replace(/,/g, '')
                  setAmounts((prev) => ({ ...prev, [cat]: raw ? Number(raw) : 0 }))
                }}
                className="mt-1 h-11 text-lg"
                aria-label={`${CATEGORY_LABELS[cat]}の予算`}
              />
              <Button
                size="sm"
                variant="ghost"
                className="w-full hover:!bg-[var(--cta-bg)] hover:!text-white"
                onClick={() => setIsFixed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
              >
                {isFixed[cat] ? '変動費にする' : '固定費にする'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[var(--cta-bg)] text-white hover:opacity-90"
        >
          {isSaving ? '保存中...' : '予算を設定する'}
        </Button>
      </div>
    </div>
  )
}
