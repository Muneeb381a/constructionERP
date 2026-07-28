import type { ReactNode } from "react";

const SIZE_CLASSES = { md: "max-w-md", lg: "max-w-lg" } as const;

export function Modal({
  title,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className={`w-full ${SIZE_CLASSES[size]} rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
