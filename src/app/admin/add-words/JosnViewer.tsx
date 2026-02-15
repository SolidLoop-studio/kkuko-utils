import { useState, useEffect, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

type WordEntry = { word: string, themes: string[] }
type JsonData = WordEntry[];

// JSON 뷰어 컴포넌트
interface JsonViewerProps {
  data: JsonData;
}

const JsonViewer = ({ data }: JsonViewerProps) => {
  const [jsonLines, setJsonLines] = useState<string[]>([]);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [containerWidth, setContainerWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  // JSON을 라인 별로 분리
  useEffect(() => {
    const formattedJson = JSON.stringify(data, null, 2);
    const lines = formattedJson.split('\n');
    setJsonLines(lines);
  }, [data]);

  // 컨테이너 크기 측정
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => {
        if (containerRef.current) {
          resizeObserver.unobserve(containerRef.current);
        }
      };
    }
  }, []);

  // 각 라인 렌더링 (들여쓰기 보존)
  const Row = ({ index, style }: ListChildComponentProps) => {
    const line = jsonLines[index] || "";
    // 들여쓰기 계산 (공백 2칸 기준)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    // 2칸마다 0.75rem(=12px) padding-left 추가
    const paddingLeft = `${indent * 0.6}ch`;

    return (
      <div
        style={{ ...style, paddingLeft }}
        className="font-mono text-sm whitespace-pre text-gray-900 dark:text-gray-100"
      >
        {line}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 overflow-auto"
    >
      <List
        height={240}
        itemCount={jsonLines.length}
        itemSize={20}
        width="100%"
        className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-900"
      >
        {Row}
      </List>
    </div>
  );
};

export default JsonViewer;
