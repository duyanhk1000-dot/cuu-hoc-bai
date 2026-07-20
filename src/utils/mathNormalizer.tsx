import React from 'react';

/**
 * Math Normalizer Utility
 * Xử lý, chuẩn hóa công thức toán học (LaTeX) và chống lỗi hiển thị trong React.
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

const PROTECTED_KEYWORDS = new Set(['aligned', 'matrix', 'cases', 'sin', 'cos', 'tan', 'log', 'ln', 'lim', 'text', 'left', 'right', 'times', 'div', 'frac', 'sqrt', 'le', 'ge', 'ne', 'approx', 'rightarrow']);

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
 * 2. Gộp các dòng công thức toán bị ngắt dòng sai lệch
 */
export const mergeBrokenMathLines = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const mergedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    
    // Nếu dòng hiện tại trống hoặc là tiêu đề, giữ nguyên
    if (!currentLine.trim() || currentLine.trim().startsWith('#')) {
      mergedLines.push(currentLine);
      continue;
    }

    // Kiểm tra xem dòng tiếp theo có phải là phần kéo dài của công thức toán không
    // Cụ thể: Bắt đầu bằng phép toán (+, -, *, x, :, =, /, ), ], })
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
 * 3. Tự động bao bọc các biểu thức toán học thô trong văn bản bằng ký tự $ hoặc $$
 */
export const wrapRawMathInDelimiters = (text: string): string => {
  if (!text) return '';

  let lines = text.split('\n');
  lines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('$') || trimmed.startsWith('#')) {
      return line;
    }

    // A. Bao bọc các dòng phương trình độc lập
    // Ví dụ: "A = 12 + 8 × 2" -> "$A = 12 + 8 × 2$"
    const isStandaloneEquation = 
      trimmed.includes('=') && 
      /^[a-zA-Z\d\s\+\-\*\/\:\=\(\)\[\]\{\}\×\÷\·\.\²\³\√\<\>\≤\≥\≠\≈]+$/.test(trimmed);

    if (isStandaloneEquation) {
      return `$${trimmed}$`;
    }

    return line;
  });

  let result = lines.join('\n');

  // B. Bao bọc các cụm phép tính toán học ngắn trong câu văn
  // Ví dụ: "3 × 3 = 9" -> "$3 × 3 = 9$"
  result = result.replace(/(?<!\$)\b(\d+\s*[\+\-\×\÷\:\*\/]\s*\d+(?:\s*[\+\-\×\÷\:\*\/]\s*\d+)*\s*\=\s*\d+)\b(?!\$)/g, '$$$1$');

  // C. Bao bọc các ẩn số có mũ hoặc căn thức đứng đơn lẻ ngoài dấu $
  // Ví dụ: "x²" -> "$x²$"
  result = result.replace(/(?<![\$\w])([a-zA-Z][²³⁴⁵⁶⁷⁸⁹⁰]+)(?![\$\w])/g, '$$$1$');
  result = result.replace(/(?<![\$\w])(√[a-zA-Z\d]+)(?![\$\w])/g, '$$$1$');
  result = result.replace(/(?<![\$\w])(√\([^\)]+\))(?![\$\w])/g, '$$$1$');

  return result;
};

/**
 * 4. Chuẩn hóa một khối công thức toán LaTeX đơn lẻ (nằm giữa $...$ hoặc $$...$$)
 */
export const normalizeMathFormula = (formula: string): string => {
  let f = formula.trim();

  // A. Chuẩn hóa tự động phóng to các cặp dấu ngoặc tròn, vuông, nhọn nếu số ngoặc cân bằng
  // PHẢI CHẠY ĐẦU TIÊN để tránh đụng độ với các dấu nhọn {} được đưa vào sau này bởi \frac hay \text
  const countChar = (str: string, char: string) => str.split(char).length - 1;
  const countLPar = countChar(f, '(');
  const countRPar = countChar(f, ')');
  const countLBrack = countChar(f, '[');
  const countRBrack = countChar(f, ']');
  const countLBrace = (f.match(/(?<!\\)\{/g) || []).length;
  const countRBrace = (f.match(/(?<!\\)\}/g) || []).length;

  if (countLPar === countRPar && countLPar > 0 && !f.includes('\\left(')) {
    f = f.replace(/\(/g, '\\left(').replace(/\)/g, '\\right)');
  }
  if (countLBrack === countRBrack && countLBrack > 0 && !f.includes('\\left[')) {
    f = f.replace(/\[/g, '\\left[').replace(/\]/g, '\\right]');
  }
  if (countLBrace === countRBrace && countLBrace > 0 && !f.includes('\\left\\{')) {
    f = f.replace(/(?<!\\)\{/g, '\\left\\{').replace(/(?<!\\)\}/g, '\\right\\}');
  } else {
    // Nếu không biến thành ngoặc to, vẫn tự động escape dấu nhọn thô
    f = f.replace(/(?<!\\)\{/g, '\\{').replace(/(?<!\\)\}/g, '\\}');
  }

  // B. Chuẩn hóa các toán tử Unicode cơ bản
  Object.keys(UNICODE_OPERATORS).forEach(op => {
    f = f.split(op).join(UNICODE_OPERATORS[op]);
  });

  // C. Chuẩn hóa dấu chia hai chấm (:) sang \div
  f = f.replace(/(\d)\s*:\s*(\d|[a-zA-Z]|\()|(\))\s*:\s*(\d)/g, '$1$3 \\div $2$4');

  // D. Chuẩn hóa phân số toán học (ví dụ: 1/2 -> \frac{1}{2}, (a+b)/c -> \frac{a+b}{c})
  // Chỉ áp dụng cho các cụm số học ngắn hoặc biến đơn để tránh đụng chạm chữ thường
  // Phải làm TRƯỚC khi gỡ bỏ dấu ngoặc của \left và \right
  f = f.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\\left\(([^)]+)\\right\)\s*\/\s*\\left\(([^)]+)\\right\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\\left\(([^)]+)\\right\)\s*\/\s*\b([a-zA-Z\d]+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\(([^)]+)\)\s*\/\s*\b([a-zA-Z\d]+)\b/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z\d]+)\b\s*\/\s*\\left\(([^)]+)\\right\)/g, '\\frac{$1}{$2}');
  f = f.replace(/\b([a-zA-Z\d]+)\b\s*\/\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');

  // E. Chuẩn hóa số mũ Unicode (ví dụ: x² -> x^2)
  f = f.replace(/([a-zA-Z\d\)\}\]])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (match, base, sups) => {
    const power = sups.split('').map((char: string) => SUPERSCRIPTS[char] || char).join('');
    return `${base}^{${power}}`;
  });

  // F. Chuẩn hóa căn thức thô (ví dụ: \sqrt (a+b) -> \sqrt{a+b})
  f = f.replace(/\\sqrt\s*\\left\((.*?)\\right\)/g, '\\sqrt{$1}');
  f = f.replace(/\\sqrt\s*\((.*?)\)/g, '\\sqrt{$1}');
  f = f.replace(/\\sqrt\s*([a-zA-Z\d]+)/g, '\\sqrt{$1}');

  // G. Tự động bọc chữ Tiếng Việt hoặc các từ dài hơn 1 ký tự (không phải lệnh LaTeX) vào \text{...}
  // Loại trừ các từ khóa LaTeX bảo vệ
  const textCmds: string[] = [];
  let tempF = f.replace(/\\text\s*\\*\{(.*?)\\*\}/g, (match) => {
    textCmds.push(match);
    return `__TEXT_PLACEHOLDER_${textCmds.length - 1}__`;
  });

  // Bọc các từ >= 2 ký tự không bắt đầu bằng \ và không thuộc từ khóa bảo vệ
  // Sử dụng lookaround an toàn cho Unicode thay vì \b
  tempF = tempF.replace(/(?<![a-zA-ZÀ-ỹ\\])([a-zA-ZÀ-ỹ]{2,})(?![a-zA-ZÀ-ỹ])/g, (match) => {
    if (PROTECTED_KEYWORDS.has(match.toLowerCase()) || PROTECTED_KEYWORDS.has(match)) {
      return match;
    }
    return `\\text{${match}}`;
  });

  // Phục hồi lại các khối đã bảo vệ
  textCmds.forEach((cmd, idx) => {
    tempF = tempF.replace(`__TEXT_PLACEHOLDER_${idx}__`, cmd);
  });
  f = tempF;

  return f;
};

/**
 * 5. Tự động phát hiện các chuỗi biến đổi nhiều dòng liên tiếp để gộp thành aligned block
 */
export const groupConsecutiveEquations = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const processedLines: string[] = [];

  let equationBlock: string[] = [];
  let commonLHS = '';

  const flushBlock = () => {
    if (equationBlock.length === 0) return;
    if (equationBlock.length === 1) {
      processedLines.push(equationBlock[0]);
    } else {
      const alignedLines = equationBlock.map((eq, idx) => {
        const cleanEq = eq.replace(/^\$\$|^\$|\$\$$|\$$/g, '').trim();
        const equalsIdx = cleanEq.indexOf('=');
        if (equalsIdx >= 0) {
          const lhs = cleanEq.substring(0, equalsIdx).trim();
          const rhs = cleanEq.substring(equalsIdx + 1).trim();
          if (idx === 0) {
            return `${lhs} &= ${rhs}`;
          } else {
            if (lhs === commonLHS || !lhs) {
              return `  &= ${rhs}`;
            } else {
              return `${lhs} &= ${rhs}`;
            }
          }
        }
        return cleanEq;
      });

      // Chuẩn hóa toán học cho TỪNG dòng biến đổi riêng lẻ để tránh làm hỏng cấu trúc \begin{aligned}
      const normalizedLines = alignedLines.map(line => normalizeMathFormula(line));

      processedLines.push(`$$\n\\begin{aligned}\n${normalizedLines.join(' \\\\\n')}\n\\end{aligned}\n$$`);
    }
    equationBlock = [];
    commonLHS = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleanLine = line.trim();

    const isEquation = 
      (cleanLine.startsWith('$') || /^[a-zA-Z\d\s]+\=/.test(cleanLine)) && 
      cleanLine.includes('=') && 
      !cleanLine.includes('##') && 
      !cleanLine.startsWith('- ');

    if (isEquation) {
      const equalsIdx = cleanLine.replace(/^\$|\$$/g, '').indexOf('=');
      const lhs = equalsIdx >= 0 ? cleanLine.replace(/^\$|\$$/g, '').substring(0, equalsIdx).trim() : '';

      if (equationBlock.length === 0) {
        equationBlock.push(line);
        commonLHS = lhs;
      } else if (lhs === commonLHS || !lhs || commonLHS === '') {
        equationBlock.push(line);
        if (!commonLHS && lhs) commonLHS = lhs;
      } else {
        flushBlock();
        equationBlock.push(line);
        commonLHS = lhs;
      }
    } else {
      flushBlock();
      processedLines.push(line);
    }
  }

  flushBlock();

  return processedLines.join('\n');
};

/**
 * 6. Pipeline hoàn chỉnh chuẩn hóa văn bản bài giảng chứa toán học
 */
export const normalizeText = (text: string): string => {
  if (!text) return '';

  // Bước 1: Khôi phục ký tự bị JSON nuốt
  let step1 = restoreEscapedJSONChars(text);

  // Bước 2: Nối các dòng toán bị ngắt dòng lỗi
  let step2 = mergeBrokenMathLines(step1);

  // Bước 3: Tự động bao bọc toán học thô bên ngoài dấu $
  let step3 = wrapRawMathInDelimiters(step2);

  // Bước 4: Tìm và chuẩn hóa nội dung các biểu thức toán LaTeX nằm giữa $ hoặc $$
  let step4 = step3.replace(/(\$\$.*?\$\$|\$.*?\$)/gs, (match) => {
    const isDisplay = match.startsWith('$$');
    const delimiters = isDisplay ? '$$' : '$';
    const rawFormula = isDisplay ? match.slice(2, -2) : match.slice(1, -1);
    
    const cleanFormula = normalizeMathFormula(rawFormula);
    return `${delimiters}${cleanFormula}${delimiters}`;
  });

  // Bước 5: Nhóm nhiều dòng phương trình liên tiếp thành aligned block
  let step5 = groupConsecutiveEquations(step4);

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
    const parts = textStr.split(/(\$\$.*?\$\$|\$.*?\$)/g);
    
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
