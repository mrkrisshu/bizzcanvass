'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { CanvasGrid } from '@/components/CanvasGrid'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download } from 'lucide-react'
import { BusinessModelCanvas } from '@/lib/database.types'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

export default function CanvasPage() {
  const router = useRouter()
  const params = useParams()
  const canvasId = params?.id as string

  const [canvas, setCanvas] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (canvasId) {
      fetchCanvas()
    }
  }, [canvasId])

  const fetchCanvas = async () => {
    try {
      const ref = doc(db, 'canvases', canvasId)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        console.error('Canvas not found:', canvasId)
        setLoading(false)
        router.push('/dashboard')
        return
      }
      const data = { id: snap.id, ...snap.data() } as any
      setCanvas(data)
      setLoading(false)
    } catch (e: any) {
      console.error('Error loading canvas:', e)
      setError(e?.message || 'Missing or insufficient permissions')
      setLoading(false)
      alert('You do not have permission to view this canvas.')
      router.push('/dashboard')
    }
  }

  const handleSave = async (data: BusinessModelCanvas) => {
    setSaving(true)
    try {
      const ref = doc(db, 'canvases', canvasId)
      await updateDoc(ref, { data: data as any, updated_at: new Date().toISOString() })
    } catch (error) {
      console.error('Error saving canvas:', error)
      alert('Failed to save canvas')
    }
    setSaving(false)
  }

  const exportToPDF = async () => {
    const element = document.getElementById('canvas-grid')
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: '#000000',
      width: 1920,
      height: 1080,
      windowWidth: 1920,
      windowHeight: 1080,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${canvas.title || 'business-model-canvas'}.pdf`)
  }

  const exportToPNG = async () => {
    const element = document.getElementById('canvas-grid')
    if (!element) return

    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: '#000000',
      width: 1920,
      height: 1080,
      windowWidth: 1920,
      windowHeight: 1080,
    })

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${canvas.title || 'business-model-canvas'}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const exportToExcel = async () => {
    if (!canvas || !canvas.data) return

    const data = canvas.data as BusinessModelCanvas

    const cleanContent = (content: string | string[]): string => {
      if (Array.isArray(content)) {
        return content.join('\n\n')
      }
      const lines = content.split('\n')
      const cleaned = lines
        .filter(line => {
          const trimmed = line.trim()
          return trimmed && !(trimmed.match(/^[🧑💻🎯📚🏢💰📊🔑⚙️👥💡📱💳]\s*.*\?$/) && !trimmed.includes('Answer'))
        })
        .map(line => {
          let c = line.replace(/^[🧑💻🎯📚🏢💰📊🔑⚙️👥💡📱💳]\s*/g, '')
          c = c.replace(/^Answer:\s*/i, '')
          return c.trim()
        })
        .filter(line => line.length > 0)
        .join('\n')
      return cleaned
    }

    const createRichText = (text: string) => {
      const lines = text.split('\n')
      const richText: { text: string; font?: { bold?: boolean; size?: number } }[] = []

      lines.forEach((line, idx) => {
        const isHeading = line.match(/^(For |Primary |Secondary |Tertiary |Key |Core |Main |Most |Technical |Growth |Customer |Channel |Add-ons |Estimated |What |Who |Through |Reaching )/i) || line.endsWith(':')
        richText.push({ text: line + (idx < lines.length - 1 ? '\n' : ''), font: { bold: !!isHeading, size: 9 } })
      })

      return richText.length > 0 ? { richText } : text
    }

    const colors = {
      navyBlue: '1F4E78',
      burgundy: '70254F',
      green: '70AD47',
      valueProposition: '70254F',
      valueArchitecture: '1F4E78',
      profitEquation: '70AD47',
    }

    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    } as const

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Business Model Canvas')

    ws.columns = [
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 2 },
      { width: 20 },
    ]

    // Title
    ws.mergeCells('A1:E1')
    const titleCell = ws.getCell('A1')
    titleCell.value = (canvas.title as string) || 'Business Model Canvas'
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }

    // Legend
    const legendCells = [
      { addr: 'G1', text: 'Value Proposition', color: colors.valueProposition },
      { addr: 'G2', text: 'Value Architecture', color: colors.valueArchitecture },
      { addr: 'G3', text: 'Profit Equation', color: colors.profitEquation },
    ]
    legendCells.forEach(({ addr, text, color }) => {
      const c = ws.getCell(addr)
      c.value = text
      c.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } }
      c.border = borderStyle
      ws.getRow(parseInt(addr.slice(1), 10)).height = 28
    })

    // Spacer row
    ws.getRow(4).height = 8

    // Top headers
    const topHeaders = ['Key Partners', 'Key Activities', 'Value Propositions', 'Customer Relationships', 'Customer Segments']
    for (let i = 0; i < topHeaders.length; i++) {
      const h = topHeaders[i]
      const headerCell = ws.getRow(5).getCell(i + 1)
      headerCell.value = h
      const headerColor = ['Key Partners', 'Key Activities'].includes(h) || ['Key Resources', 'Channels'].includes(h)
        ? colors.navyBlue
        : colors.burgundy
      headerCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      headerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${headerColor}` } }
      headerCell.border = borderStyle
    }
    ws.getRow(5).height = 22

    // Top content (row 6)
    const topContent = [
      cleanContent(data.key_partners),
      cleanContent(data.key_activities),
      cleanContent(data.value_propositions),
      cleanContent(data.customer_relationships),
      cleanContent(data.customer_segments),
    ]
    for (let i = 0; i < topContent.length; i++) {
      const txt = topContent[i]
      const cell6 = ws.getRow(6).getCell(i + 1)
      ;(cell6 as any).value = createRichText(txt)
      cell6.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
      cell6.border = borderStyle
    }
    // Dynamically size row 6 height based on content length
    const estimateLines = (text: string, colWidthChars: number) => {
      const t = (text || '').split('\n')
      let lines = 0
      for (const line of t) {
        const len = Math.max(1, line.trim().length)
        const approx = Math.max(1, Math.ceil(len / Math.max(10, colWidthChars)))
        lines += approx
      }
      return Math.max(1, lines)
    }

    const colWidthsRow6 = [1,2,3,4,5].map(idx => (ws.getColumn(idx).width as number) || 28)
    let maxLinesRow6 = 1
    for (let i = 0; i < topContent.length; i++) {
      const txt = topContent[i]
      const lines = estimateLines(txt, colWidthsRow6[i])
      maxLinesRow6 = Math.max(maxLinesRow6, lines)
    }
    ws.getRow(6).height = Math.min(500, Math.max(100, maxLinesRow6 * 14 + 6))

    // Middle headers (row 8)
    const midHeaders = ['Key Resources', 'Channels']
    ;[['B8', midHeaders[0], colors.navyBlue], ['D8', midHeaders[1], colors.navyBlue]].forEach(([addr, text, color]: any) => {
      const midCell = ws.getCell(addr as string)
      midCell.value = text as string
      midCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      midCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      midCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } }
      midCell.border = borderStyle
      ws.getRow(parseInt((addr as string).slice(1), 10)).height = 22
    })

    // Middle content (row 9)
    const keyResourcesCell = ws.getCell('B9')
    ;(keyResourcesCell as any).value = createRichText(cleanContent(data.key_resources))
    keyResourcesCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    keyResourcesCell.border = borderStyle

    const channelsCell = ws.getCell('D9')
    ;(channelsCell as any).value = createRichText(cleanContent(data.channels))
    channelsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    channelsCell.border = borderStyle
    // Dynamically size row 9 height based on content length in B and D
    const widthB = (ws.getColumn(2).width as number) || 28
    const widthD = (ws.getColumn(4).width as number) || 28
    const linesB = estimateLines(cleanContent(data.key_resources), widthB)
    const linesD = estimateLines(cleanContent(data.channels), widthD)
    ws.getRow(9).height = Math.min(500, Math.max(80, Math.max(linesB, linesD) * 14 + 6))

    // Bottom headers (row 11) and merges
    ws.mergeCells('A11:B11')
    ws.mergeCells('C11:D11')
    const costHeader = ws.getCell('A11')
    costHeader.value = 'Cost Structure'
    costHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    costHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    costHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colors.green}` } }
    costHeader.border = borderStyle

    const revenueHeader = ws.getCell('C11')
    revenueHeader.value = 'Revenue Streams'
    revenueHeader.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    revenueHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    revenueHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${colors.green}` } }
    revenueHeader.border = borderStyle
    ws.getRow(11).height = 22

    // Bottom content (row 12)
    ws.mergeCells('A12:B12')
    ws.mergeCells('C12:D12')
    const costCell = ws.getCell('A12')
    ;(costCell as any).value = createRichText(cleanContent(data.cost_structure))
    costCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    costCell.border = borderStyle

    const revenueCell = ws.getCell('C12')
    ;(revenueCell as any).value = createRichText(cleanContent(data.revenue_streams))
    revenueCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    revenueCell.border = borderStyle
    // Dynamically size row 12 for merged cells A:B and C:D
    const widthAB = ((ws.getColumn(1).width as number) || 28) + ((ws.getColumn(2).width as number) || 28)
    const widthCD = ((ws.getColumn(3).width as number) || 28) + ((ws.getColumn(4).width as number) || 28)
    const linesAB = estimateLines(cleanContent(data.cost_structure), widthAB)
    const linesCD = estimateLines(cleanContent(data.revenue_streams), widthCD)
    ws.getRow(12).height = Math.min(500, Math.max(80, Math.max(linesAB, linesCD) * 14 + 6))

    // Borders for other cells used
    ;['A5','B5','C5','D5','E5','B8','D8'].forEach(addr => {
      ws.getCell(addr).border = borderStyle
    })

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const filename = `${canvas.title || 'business-model-canvas'}.xlsx`

    // Try Web Share API (mobile-friendly) with file share
    try {
      // Some browsers require File instead of Blob for share
      const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      // @ts-ignore - canShare not typed in TS DOM lib
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // @ts-ignore - share not typed with files in TS DOM lib
        await navigator.share({ files: [file], title: canvas.title || 'Business Model Canvas', text: 'Exported from BizCanvas AI' })
        return
      }
    } catch (err) {
      console.warn('Web Share unavailable or failed, falling back to download', err)
    }

    // Fallback: regular download via hidden anchor (better compatibility on mobile)
    const link = document.createElement('a')
    link.style.display = 'none'
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      URL.revokeObjectURL(link.href)
      document.body.removeChild(link)
    }, 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">{error ? `Error: ${error}` : 'Loading canvas...'}</div>
      </div>
    )
  }

  if (!canvas) {
    return null
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push('/dashboard')}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-bold">{canvas.title}</h1>
                <p className="text-sm text-gray-400">
                  {saving ? 'Saving...' : 'Auto-saved'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Button
                onClick={exportToPNG}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PNG
              </Button>
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div id="canvas-grid" className="p-8 bg-black min-h-screen">
          <h2 className="text-3xl font-bold mb-12 text-center">{canvas.title}</h2>
          <CanvasGrid canvasData={canvas.data} canvasId={canvasId} onSave={handleSave} />
        </div>
      </main>
    </div>
  )
}
