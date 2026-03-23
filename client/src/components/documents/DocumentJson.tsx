import Editor from '@monaco-editor/react';

interface DocumentJsonProps {
  documents: any[];
}

export function DocumentJson({ documents }: DocumentJsonProps) {
  const jsonText = JSON.stringify(documents, null, 2);

  return (
    <div className="doc-json">
      <Editor
        height="100%"
        defaultLanguage="json"
        value={jsonText}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          automaticLayout: true,
          padding: { top: 10 },
        }}
      />
    </div>
  );
}
