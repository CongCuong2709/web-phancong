// Khai báo các thư viện global đang dùng qua <script> trong index.html
// (Lucide icons qua CDN).

export {};

declare global {
  interface Window {
    lucide: {
      createIcons(): void;
    };
  }
}
