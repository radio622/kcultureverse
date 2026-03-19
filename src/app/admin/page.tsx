"use client";

import { useState } from "react";
import Head from "next/head";

export default function AdminPage() {
  const [formData, setFormData] = useState({ name: "", spotifyId: "", nameKo: "" });
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.spotifyId) return alert("필수값을 입력하세요");
    
    setLoading(true);
    setLog(`Adding ${formData.name}...\n`);

    try {
      const res = await fetch("/api/admin/add-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      
      let newLog = log;
      if (data.log) newLog += `[STDOUT]\n${data.log}\n`;
      if (data.errorLog) newLog += `[STDERR]\n${data.errorLog}\n`;
      if (data.error) newLog += `[ERROR]\n${data.error}\n`;
      
      setLog(newLog + "\n[DONE]");
      if (data.success) {
        setFormData({ name: "", spotifyId: "", nameKo: "" });
      }
    } catch (err: any) {
      setLog(prev => prev + `\n[NETWORK ERROR]\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-200 p-8 font-sans">
      <Head>
        <title>K-Culture Universe Admin</title>
      </Head>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-white/90">K-Culture Universe Admin</h1>
        <p className="text-gray-400 mb-8">안전하고 효율적인 아티스트 Pre-bake 파이프라인 관리 도구</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 입력 폼 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-2xl">➕</span> 새 아티스트 추가
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  아티스트 영문 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  placeholder="예: AKMU"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  아티스트 한글 이름 (선택)
                </label>
                <input
                  type="text"
                  value={formData.nameKo}
                  onChange={(e) => setFormData({ ...formData, nameKo: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  placeholder="예: 악동뮤지션"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Spotify ID <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.spotifyId}
                    onChange={(e) => setFormData({ ...formData, spotifyId: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                    placeholder="22자리 알파뉴메릭 (예: 6s1pCNXcbdtQJlsnM1hRIA)"
                  />
                  <span className="absolute left-3 top-3 text-gray-500">🔗</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 mt-4 rounded-xl font-medium transition-all ${
                  loading
                    ? "bg-white/10 text-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]"
                }`}
              >
                {loading ? "Pre-bake 진행 중 (~10초 대기)..." : "아티스트 추가 및 Pre-bake 실행"}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-900/20 rounded-xl text-sm text-blue-200/80 leading-relaxed border border-blue-500/20">
              <strong className="block text-blue-300 mb-1">💡 효율화된 ID 획득 워크플로우:</strong>
              1. Spotify 웹 브라우저에서 아티스트 검색<br/>
              2. URL 복사 (예: <code>open.spotify.com/artist/XXXXXXXXXXX</code>)<br/>
              3. 위 입력창에 XXXXXXXXXXX 부분 붙여넣기<br/>
              이 방식은 AI 토큰을 0으로 소모하며 10배 이상 빠릅니다.
            </div>
          </div>

          {/* 터미널 로그 */}
          <div className="bg-black border border-white/10 rounded-2xl flex flex-col overflow-hidden h-full min-h-[400px]">
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <span className="text-xs font-mono text-gray-500 ml-2">Terminal Output</span>
            </div>
            <div className="p-4 overflow-auto flex-1 text-sm font-mono text-green-400 whitespace-pre-wrap">
              {log || "대기 중..."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
