'use client'

import { useEffect, useMemo, useState } from 'react'

import type { BudgetItem, ExpenseCategory } from '@lifebalance/shared/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'

interface BudgetEditFormProps {
  items: BudgetItem[]
  onSaveItem: (payload: { id: string; limit_amount: number; is_fixed: boolean }) => Promise<unknown>
  onSaveAll: (payload: {
    budgets: Array<{ category: ExpenseCategory; limit_amount: number; is_fixed: boolean }>
  }) => Promise<unknown>
  savingItemId?: string | null
  savingAll?: boolean
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

export function BudgetEditForm({
  items,
  onSaveItem,
  onSaveAll,
  savingItemId = null,
  savingAll = false,
}: BudgetEditFormProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, { limit_amount: number; is_fixed: boolean }>>({})

  useEffect(() => {
    setValues(
      Object.fromEntries(
        items.map((item) => [item.id, { limit_amount: item.limit_amount, is_fixed: item.is_fixed }]),
      ),
    )
  }, [items])

  const canSaveAll = useMemo(
    () =>
      items.every((item) => {
        const current = values[item.id]
        return current && current.limit_amount >= 0
      }),
    [items, values],
  )

  if (items.length === 0) {
    return <p className="text-sm text-text2">予算データがありません。</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-text hover:bg-accent hover:text-white"
          onClick={() =>
            onSaveAll({
              budgets: items.map((item) => ({
                category: item.category,
                limit_amount: Math.max(0, Math.round(values[item.id]?.limit_amount ?? item.limit_amount)),
                is_fixed: values[item.id]?.is_fixed ?? item.is_fixed,
              })),
            })
          }
          disabled={!canSaveAll || savingAll}
        >
          {savingAll ? '一括保存中...' : '一括保存'}
        </Button>
      </div>

      {items.map((item) => {
        const current = values[item.id] ?? { limit_amount: item.limit_amount, is_fixed: item.is_fixed }
        const isEditing = editingId === item.id
        const isSaving = savingItemId === item.id

        return (
          <div key={item.id} className="space-y-2 rounded-xl border border-border bg-card2 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-text">{CATEGORY_LABELS[item.category]}</p>
                <p className="text-xs text-text2">支出 {formatCurrency(item.spent_amount)} / 予算 {formatCurrency(current.limit_amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Input
                    type="number"
                    min={0}
                    value={current.limit_amount}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...current,
                          limit_amount: Number(event.target.value),
                        },
                      }))
                    }
                    className="w-32"
                    aria-label={`${CATEGORY_LABELS[item.category]}の予算`}
                  />
                ) : (
                  <button
                    type="button"
                    className="font-display text-lg font-semibold text-accent2"
                    onClick={() => setEditingId(item.id)}
                  >
                    {formatCurrency(current.limit_amount)}
                  </button>
                )}
                {isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await onSaveItem({
                        id: item.id,
                        limit_amount: Math.max(0, Math.round(current.limit_amount)),
                        is_fixed: current.is_fixed,
                      })
                      setEditingId(null)
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-text2">{current.is_fixed ? '固定費' : '変動費'}</p>
              <Button
                size="sm"
                variant="ghost"
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
          </div>
        )
      })}
    </div>
  )
}
