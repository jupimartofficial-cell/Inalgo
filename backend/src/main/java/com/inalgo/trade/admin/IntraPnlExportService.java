package com.inalgo.trade.admin;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import jakarta.validation.ValidationException;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;

@Component
public class IntraPnlExportService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Kolkata");

    public byte[] export(
            String format,
            IntraPnlDtos.PnlDashboardResponse dashboard
    ) {
        String normalized = format == null ? "CSV" : format.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CSV" -> exportCsv(dashboard).getBytes();
            case "XLSX" -> exportXlsx(dashboard);
            case "PDF" -> exportPdf(dashboard);
            default -> throw new ValidationException("format must be CSV, XLSX, or PDF");
        };
    }

    private String exportCsv(IntraPnlDtos.PnlDashboardResponse dashboard) {
        StringBuilder sb = new StringBuilder();
        sb.append("Date,Mode,Strategy,Instrument,PnL,Status,Exit Reason\n");
        for (IntraPnlDtos.TradeLedgerRow row : dashboard.tradeLedger()) {
            sb.append(row.date()).append(',')
                    .append(row.tradeMode()).append(',')
                    .append(escapeCsv(row.strategy())).append(',')
                    .append(escapeCsv(row.instrument())).append(',')
                    .append(row.pnl()).append(',')
                    .append(escapeCsv(row.status())).append(',')
                    .append(escapeCsv(row.exitReason())).append('\n');
        }
        return sb.toString();
    }

    private byte[] exportXlsx(IntraPnlDtos.PnlDashboardResponse dashboard) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet summary = workbook.createSheet("Summary");
            Row header = summary.createRow(0);
            header.createCell(0).setCellValue("Metric");
            header.createCell(1).setCellValue("Value");

            IntraPnlDtos.PnlSummary s = dashboard.summary();
            addSummaryRow(summary, 1, "Total P&L", s.totalPnl());
            addSummaryRow(summary, 2, "Today P&L", s.todayPnl());
            addSummaryRow(summary, 3, "Realized P&L", s.realizedPnl());
            addSummaryRow(summary, 4, "Unrealized P&L", s.unrealizedPnl());
            addSummaryRow(summary, 5, "Win Rate", s.winRate());
            addSummaryRow(summary, 6, "Avg Gain", s.avgGain());
            addSummaryRow(summary, 7, "Avg Loss", s.avgLoss());
            addSummaryRow(summary, 8, "Max Drawdown", s.maxDrawdown());

            Sheet ledger = workbook.createSheet("Trade Ledger");
            Row lHead = ledger.createRow(0);
            String[] cols = {"Date", "Time", "Mode", "Strategy", "Instrument", "P&L", "Status", "Exit Reason", "Account"};
            for (int i = 0; i < cols.length; i++) {
                lHead.createCell(i).setCellValue(cols[i]);
            }

            int idx = 1;
            for (IntraPnlDtos.TradeLedgerRow row : dashboard.tradeLedger()) {
                Row data = ledger.createRow(idx++);
                data.createCell(0).setCellValue(String.valueOf(row.date()));
                data.createCell(1).setCellValue(row.time());
                data.createCell(2).setCellValue(row.tradeMode());
                data.createCell(3).setCellValue(row.strategy());
                data.createCell(4).setCellValue(row.instrument());
                data.createCell(5).setCellValue(row.pnl().doubleValue());
                data.createCell(6).setCellValue(row.status());
                data.createCell(7).setCellValue(row.exitReason());
                data.createCell(8).setCellValue(row.account());
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ValidationException("Unable to generate XLSX export");
        }
    }

    private byte[] exportPdf(IntraPnlDtos.PnlDashboardResponse dashboard) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph("Intra P&L Summary Report"));
            doc.add(new Paragraph("Generated: " + LocalDate.now(MARKET_ZONE)));
            doc.add(Chunk.NEWLINE);

            IntraPnlDtos.PnlSummary s = dashboard.summary();
            doc.add(new Paragraph("Total P&L: " + s.totalPnl()));
            doc.add(new Paragraph("Today P&L: " + s.todayPnl()));
            doc.add(new Paragraph("Realized P&L: " + s.realizedPnl()));
            doc.add(new Paragraph("Unrealized P&L: " + s.unrealizedPnl()));
            doc.add(new Paragraph("Win Rate: " + s.winRate() + "%"));
            doc.add(new Paragraph("Max Drawdown: " + s.maxDrawdown()));
            doc.add(Chunk.NEWLINE);

            PdfPTable table = new PdfPTable(6);
            table.setWidthPercentage(100);
            table.addCell("Date");
            table.addCell("Mode");
            table.addCell("Strategy");
            table.addCell("Instrument");
            table.addCell("P&L");
            table.addCell("Exit Reason");
            for (IntraPnlDtos.TradeLedgerRow row : dashboard.tradeLedger().stream().limit(25).toList()) {
                table.addCell(String.valueOf(row.date()));
                table.addCell(row.tradeMode());
                table.addCell(row.strategy());
                table.addCell(row.instrument());
                table.addCell(String.valueOf(row.pnl()));
                table.addCell(row.exitReason());
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (Exception ex) {
            throw new ValidationException("Unable to generate PDF export");
        }
    }

    private void addSummaryRow(Sheet summary, int row, String metric, BigDecimal value) {
        Row r = summary.createRow(row);
        r.createCell(0).setCellValue(metric);
        r.createCell(1).setCellValue(value.doubleValue());
    }

    private String escapeCsv(String text) {
        if (text == null) {
            return "";
        }
        String normalized = text.replace("\"", "\"\"");
        return normalized.contains(",") || normalized.contains("\n") ? "\"" + normalized + "\"" : normalized;
    }
}
