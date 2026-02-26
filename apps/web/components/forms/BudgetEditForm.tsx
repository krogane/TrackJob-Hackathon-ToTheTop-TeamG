'use client'

import { useEffect, useState } from 'react'

import type { BudgetItem, ExpenseCategory } from '@lifebalance/shared/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

interface BudgetEditFormProps {
  items: BudgetItem[]
  onSaveItem: (payload: { id: string; limit_amount: number; is_fixed: boolean }) => Promise<unknown>
  savingItemId?: string | null
}

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

function formatAmountInput(value: string) {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }
  return Number(digitsOnly).toLocaleString('ja-JP')
}

export function BudgetEditForm({
  items,
  onSaveItem,
  savingItemId = null,
}: BudgetEditFormProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, { limit_amount: number; is_fixed: boolean }>>({})
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    setValues(
      Object.fromEntries(
        items.map((item) => [item.id, { limit_amount: item.limit_amount, is_fixed: item.is_fixed }]),
      ),
    )
    setAmountInputs(
      Object.fromEntries(items.map((item) => [item.id, item.limit_amount.toLocaleString('ja-JP')])),
    )
  }, [items])

  if (items.length === 0) {
    return <p className="text-sm text-text2">予算データがありません。</p>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const current = values[item.id] ?? { limit_amount: item.limit_amount, is_fixed: item.is_fixed }
          const isEditing = editingId === item.id
          const isSaving = savingItemId === item.id

          return (
            <Card key={item.id} className="border-border bg-card">
              <CardHeader className="space-y-3 pb-1">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-accent">{CATEGORY_LABELS[item.category]}</CardTitle>
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-text2">
                    {current.is_fixed ? '固定費' : '変動費'}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <div>
                  {isEditing ? (
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="例: 1,200"
                      value={amountInputs[item.id] ?? current.limit_amount.toLocaleString('ja-JP')}
                      onChange={(event) => {
                        const formatted = formatAmountInput(event.target.value)
                        setAmountInputs((prev) => ({
                          ...prev,
                          [item.id]: formatted,
                        }))
                        const rawNumber = formatted.replace(/,/g, '')
                        setValues((prev) => ({
                          ...prev,
                          [item.id]: {
                            ...current,
                            limit_amount: rawNumber ? Number(rawNumber) : 0,
                          },
                        }))
                      }}
                      className="mt-1 h-11 text-lg"
                      aria-label={`${CATEGORY_LABELS[item.category]}の予算`}
                    />
                  ) : (
                    <p className="font-display text-4xl font-bold text-accent2">{formatCurrency(current.limit_amount)}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-[var(--cta-bg)] hover:text-white"
                    onClick={async () => {
                      if (!isEditing) {
                        setAmountInputs((prev) => ({
                          ...prev,
                          [item.id]: current.limit_amount.toLocaleString('ja-JP'),
                        }))
                        setEditingId(item.id)
                        return
                      }

                      await onSaveItem({
                        id: item.id,
                        limit_amount: Math.max(0, Math.round(current.limit_amount)),
                        is_fixed: current.is_fixed,
                      })
                      setAmountInputs((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Math.round(current.limit_amount)).toLocaleString('ja-JP'),
                      }))
                      setEditingId(null)
                    }}
                    disabled={isSaving}
                  >
                    {isEditing ? (isSaving ? '保存中...' : '保存') : '予算を変更'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-[var(--cta-bg)] hover:text-white"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...current,
                          is_fixed: !current.is_fixed,
                        },
                      }))
                    }
                  >
                    {current.is_fixed ? '変動費にする' : '固定費にする'}
                  </Button>
                </div>

                {isEditing ? (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      キャンセル
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
