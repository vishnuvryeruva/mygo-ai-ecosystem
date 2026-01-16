package com.abap.ai.assistant.ui;

import java.util.ArrayList;
import java.util.List;

/**
 * Utility class for computing and displaying code diffs
 */
public class DiffUtils {

    public enum DiffType {
        UNCHANGED,
        ADDED,
        REMOVED,
        MODIFIED
    }

    public static class DiffLine {
        private final String content;
        private final DiffType type;
        private final int originalLineNum;
        private final int newLineNum;

        public DiffLine(String content, DiffType type, int originalLineNum, int newLineNum) {
            this.content = content;
            this.type = type;
            this.originalLineNum = originalLineNum;
            this.newLineNum = newLineNum;
        }

        public String getContent() {
            return content;
        }

        public DiffType getType() {
            return type;
        }

        public int getOriginalLineNum() {
            return originalLineNum;
        }

        public int getNewLineNum() {
            return newLineNum;
        }
    }

    /**
     * Compute a simple line-by-line diff between original and modified code
     */
    public static List<DiffLine> computeDiff(String original, String modified) {
        List<DiffLine> result = new ArrayList<>();

        String[] originalLines = original.split("\n", -1);
        String[] modifiedLines = modified.split("\n", -1);

        // Use longest common subsequence approach for diff
        int[][] lcs = computeLCS(originalLines, modifiedLines);

        // Backtrack to find the diff
        int i = originalLines.length;
        int j = modifiedLines.length;

        List<DiffLine> tempResult = new ArrayList<>();

        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && originalLines[i - 1].equals(modifiedLines[j - 1])) {
                // Lines are the same
                tempResult.add(0, new DiffLine(originalLines[i - 1], DiffType.UNCHANGED, i, j));
                i--;
                j--;
            } else if (j > 0 && (i == 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
                // Line was added
                tempResult.add(0, new DiffLine(modifiedLines[j - 1], DiffType.ADDED, -1, j));
                j--;
            } else if (i > 0) {
                // Line was removed
                tempResult.add(0, new DiffLine(originalLines[i - 1], DiffType.REMOVED, i, -1));
                i--;
            }
        }

        return tempResult;
    }

    /**
     * Compute longest common subsequence matrix
     */
    private static int[][] computeLCS(String[] a, String[] b) {
        int m = a.length;
        int n = b.length;
        int[][] lcs = new int[m + 1][n + 1];

        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (a[i - 1].equals(b[j - 1])) {
                    lcs[i][j] = lcs[i - 1][j - 1] + 1;
                } else {
                    lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
                }
            }
        }

        return lcs;
    }

    /**
     * Format diff for display with line numbers
     */
    public static String formatDiffWithLineNumbers(List<DiffLine> diff) {
        StringBuilder sb = new StringBuilder();

        for (DiffLine line : diff) {
            String prefix;
            switch (line.getType()) {
                case ADDED:
                    prefix = "+ ";
                    break;
                case REMOVED:
                    prefix = "- ";
                    break;
                default:
                    prefix = "  ";
            }

            sb.append(String.format("%3d | %s%s\n",
                    line.getNewLineNum() > 0 ? line.getNewLineNum() : line.getOriginalLineNum(),
                    prefix,
                    line.getContent()));
        }

        return sb.toString();
    }
}
