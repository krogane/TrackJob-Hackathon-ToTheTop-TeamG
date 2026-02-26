'use client'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ExportTransactionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: () => Promise<void>
  isDownloading: boolean
}

export function ExportTransactionsModal({
  open,
  onOpenChange,
  onDownload,
  isDownloading,
}: ExportTransactionsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] bg-card">
        <DialogHeader>
          <DialogTitle>支出データを保存</DialogTitle>
        </DialogHeader>
        <DialogBody className="py-4">
          <p className="text-sm leading-relaxed text-text">
            支出データをダウンロードすることで、外部のAI・サービス等でもあなたの支出を分析できます。
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isDownloading}>
            キャンセル
          </Button>
          <Button
            type="button"
            className="bg-[var(--cta-bg)] text-[var(--cta-text)] hover:bg-[var(--cta-hover)]"
            onClick={() => void onDownload()}
            disabled={isDownloading}
          >
            {isDownloading ? 'ダウンロード中...' : 'ダウンロード（.csv）'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
