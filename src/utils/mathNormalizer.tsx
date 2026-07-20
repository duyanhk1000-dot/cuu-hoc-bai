import React from 'react';

/**
 * Math Normalizer Utility (Refactored & Simplified)
 * Chuẩn hóa các công thức toán học và sửa lỗi hiển thị KaTeX/Markdown.
 */

// Bảng ánh xạ các ký tự Unicode toán học thô sang LaTeX tương ứng
const UNICODE_OPERATORS: { [key: string]: string } = {
  '×': '\\times',
  '*': '\\times',
  '÷': '\\div',
  '·': '\\cdot',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '∞': '\\infty',
  'π': '\\pi',
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'θ': '\\theta',
  'Δ': '\\Delta',
  'Σ': '\\Sigma',
  '∈': '\\in',
  '∉': '\\notin',
  '⊂': '\\subset',
  '⊃': '\\supset',
  '⊆': '\\subseteq',
  '∪': '\\cup',
  '∩': '\\cap',
  '⇒': '\\Rightarrow',
  '⇔': '\\Leftrightarrow',
  '→': '\\rightarrow',
  '⟶': '\\longrightarrow',
  '√': '\\sqrt '
};

const SUPERSCRIPTS: { [key: string]: string } = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
};

/**
 * 1. Khôi phục các ký tự thoát bị nuốt do quá trình parse JSON
 */
export const restoreEscapedJSONChars = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\t/g, '\\t')       // Phục hồi \t thành \t (Sửa \text, \times, \theta...)
    .replace(/\r/g, '\\r')       // Phục hồi \r thành \r (Sửa \rightarrow, \rho...)
    .replace(/[\b]/g, '\\b')     // Phục hồi \b thành \b (Sửa \braceleft, \beta...)
    .replace(/\f/g, '\\f')       // Phục hồi \f thành \f (Sửa \frac...)
    .replace(/\v/g, '\\v');      // Phục hồi \v thành \v (Sửa \varepsilon...)
};

/**
 * 2. Thay thế dấu bọc toán học LaTeX thô \( \) và \[ \] thành $ và $$ tương ứng
 */
export const convertMathDelimiters = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\\\\\(/g, '$')     // Phục hồi và chuyển \( -> $
    .replace(/\\\\\)/g, '$')     // Phục hồi và chuyển \) -> $
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    .replace(/\\\\\[/g, '$$$$')  // Phục hồi và chuyển \[ -> $$
    .replace(/\\\\\]/g, '$$$$')  // Phục hồi và chuyển \] -> $$
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$');
};

/**
 * 3. Gỡ bỏ (unwrap) các lệnh \text{...} bị AI sinh nhầm ngoài môi trường toán học
 */
export const unwrapExternalTextCommands = (text: string): string => {
  if (!text) return '';
  
  // Tách văn bản thành các khối chẵn (ngoài $) và lẻ (trong $)
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/gs);
  const cleanedParts = parts.map((part, idx) => {
    if (idx % 2 === 0) {
      return part.replace(/\\+text\s*\{([^{}]+)\}/g, '$1');
    }
    return part;
  });
  
  return cleanedParts.join('');
};

/**
 * 4. Gộp các dòng công thức toán bị ngắt dòng sai lệch
 */
export const mergeBrokenMathLines = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const mergedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    
    if (!currentLine.trim() || currentLine.trim().startsWith('#')) {
      mergedLines.push(currentLine);
      continue;
    }

    // Gộp dòng nếu dòng tiếp theo bắt đầu bằng toán tử toán học
    while (
      i + 1 < lines.length && 
      lines[i + 1].trim() && 
      /^\s*([\-\+\*\×\/\=\:\÷\)\}\]])/.test(lines[i + 1])
    ) {
      const nextLine = lines[i + 1].trim();
      currentLine = currentLine.trim() + ' ' + nextLine;
      i++; // Bỏ qua dòng tiếp theo vì đã gộp
    }
    
    mergedLines.push(currentLine);
  }

  return mergedLines.join('\n');
};

/**
 * 5. Chuẩn hóa công thức toán học thực sự bên trong $ hoặc $$
 */
export const normalizeMathFormula = (formula: string): string => {
  let f = formula.trim();

  // A. Trích xuất và bảo vệ tạm thời các tham số của câu lệnh LaTeX (\sqrt{x}, \frac{a}{b}, \text{abc}...)
  // Việc này giúp Bracket Normalizer không nhầm lẫn và escape dấu ngoặc của các lệnh LaTeX
  const commandBraces: string[] = [];
  let temp = f;
  for (let iter = 0; iter < 2; iter++) {
    temp = temp.replace(/(\\[a-zA-Z]+)\{([^{}]+)\}(?:\{([^{}]+)\})?/g, (match) => {
      commandBraces.push(match);
      return `__CMD_BRACE_${commandBraces.length - 1}__`;
    });
  }

  // B. Chuẩn hóa ngoặc co giãn thông minh \left \right nếu số ngoặc cân bằng (chỉ áp dụng lên ngoặc toán học thực tế)
  const countChar = (str: string, char: string) => str.split(char).length - 1;
  const countLPar = countChar(temp, '(');
  const countRPar = countChar(temp, ')');
  const countLBrack = countChar(temp, '[');
  const countRBrack = countChar(temp, ']');
  const countLBrace = (temp.match(/(?<!\\)\{/g) || []).length;
  const countRBrace = (temp.match(/(?<!\\)\}/g) || []).length;

  if (countLPar === countRPar && countLPar > 0 && !temp.includes('\\left(')) {
    temp = temp.replace(/\(/g, '\\left(').replace(/\)/g, '\\right)');
  }
  if (countLBrack === countRBrack && countLBrack > 0 && !temp.includes('\\left[')) {
    temp = temp.replace(/\[/g, '\\left[').replace(/\]/g, '\\right]');
  }
  if (countLBrace === countRBrace && countLBrace > 0 && !temp.includes('\\left\\{')) {
    temp = temp.replace(/(?<!\\)\{/g, '\\left\\{').replace(/(?<!\\)\}/g, '\\right\\}');
  } else {
    temp = temp.replace(/(?<!\\)\{/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
  }

  // Khôi phục lại các tham số LaTeX đã bảo vệ
  for (let i = commandBraces.length - 1; i >= 0; i--) {
    temp = temp.replace(`__CMD_BRACE_${i}__`, commandBraces[i]);
  }
  f = temp;

  // C. Chuẩn hóa các toán tử Unicode thô sang LaTeX
  Object.keys(UNICODE_OPERATORS).forEach(op => {
    f = f.split(op).join(UNICODE_OPERATORS[op]);
  });

  // D. Chuẩn hóa dấu hai chấm (:) làm phép chia sang \div
  f = f.replace(/(\d)\s*:\s*(\d|[a-zA-Z]|\()|(\))\s*:\s*(\d)/g, '$1$3 \\div $2$4');

  // E. Chuẩn hóa phân số toán học trong math mode (ví dụ: a/b -> \frac{a}{b})
  f = f.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\\left\(([^)]+)\\right\)\s*\/\s*\\left\(([^)]+)\\right\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\\left\(([^)]+)\\right\)\s*\/\s*\b([a-zA-Z\d]+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\(([^)]+)\)\s*\/\s*\b([a-zA-Z\d]+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z\d]+)\b\s*\/\s*\\left\(([^)]+)\\right\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z\d]+)\b\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');

  // F. Chuẩn hóa số mũ Unicode (ví dụ: x² -> x^2)
  f = f.replace(/([a-zA-Z\d\)\}\]])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match, base, sups) => {
    const power = sups.split('').map((char: string) => SUPERSCRIPTS[char] || char).join('');
    return `${base}^{${power}}`;
  });

  // G. Chuẩn hóa căn thức thô (ví dụ: \sqrt (a+b) -> \sqrt{a+b})
  f = f.replace(/\\sqrt\s*\\left\((.*?)\\right\)/g, '\\sqrt{$1}');
  f = f.replace(/\\sqrt\s*\((.*?)\)/g, '\\sqrt{$1}');
  f = f.replace(/\\sqrt\s*([a-zA-Z\d]+)/g, '\\sqrt{$1}');

  return f;
};

/**
 * 6. Pipeline hoàn chỉnh chuẩn hóa văn bản bài giảng
 */
export const normalizeText = (text: string): string => {
  if (!text) return '';

  // Bước 1: Khôi phục ký tự bị JSON nuốt
  let step1 = restoreEscapedJSONChars(text);

  // Bước 2: Chuyển đổi các dấu bọc toán học thô \(\) và \[\] về $ và $$
  let step2 = convertMathDelimiters(step1);

  // Bước 3: Gỡ bỏ các lệnh \text{} bị AI viết nhầm ngoài dấu $
  let step3 = unwrapExternalTextCommands(step2);

  // Bước 4: Gộp các dòng toán bị ngắt dòng lỗi
  let step4 = mergeBrokenMathLines(step3);

  // Bước 5: Tìm và chuẩn hóa nội dung các biểu thức toán LaTeX thực sự nằm giữa $ hoặc $$
  let step5 = step4.replace(/(\$\$.*?\$\$|\$.*?\$)/gs, (match) => {
    const isDisplay = match.startsWith('$$');
    const delimiters = isDisplay ? '$$' : '$';
    const rawFormula = isDisplay ? match.slice(2, -2) : match.slice(1, -1);
    
    const cleanFormula = normalizeMathFormula(rawFormula);
    return `${delimiters}${cleanFormula}${delimiters}`;
  });

  return step5;
};

/**
 * 7. Parser và Render công thức toán LaTeX thời gian thực (React Component level)
 */
export const parseMathAndText = (textStr: string): React.ReactNode => {
  const katex = (window as any).katex;
  if (!katex) {
    return <span>{textStr}</span>;
  }

  try {
    // Sửa lỗi regex split: loại bỏ khoảng trắng thừa trước $$
    const parts = textStr.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g);
    
    return parts.map((part, idx) => {
      const key = `math-part-${idx}`;
      
      // Xử lý Display Math $$...$$
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const formula = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(formula, { displayMode: true, throwOnError: false });
          return <div key={key} className="my-4 overflow-x-auto select-all" dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
          return <div key={key} className="text-rose-400 p-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono">{part}</div>;
        }
      }
      
      // Xử lý Inline Math $...$
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(formula, { displayMode: false, throwOnError: false });
          return <span key={key} className="mx-0.5 select-all" dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
          return <span key={key} className="text-rose-400 font-mono text-xs">{part}</span>;
        }
      }
      
      return part;
    });
  } catch (e) {
    return <span>{textStr}</span>;
  }
};
