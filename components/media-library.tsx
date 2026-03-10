"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Upload, Trash2, Edit2, Play, Music, FileText, Check, X, Loader2, Download, MoreVertical, Filter } from "lucide-react"
import { useSession } from "next-auth/react"

interface MediaFile {
    name: string
    size: number
    mtime: string
}

interface MediaLibraryProps {
    onSelectFile?: (filename: string) => void
    onClose?: () => void
    token?: string
}

export function MediaLibrary({ onSelectFile, onClose, token: propToken }: MediaLibraryProps) {
    const { data: session } = useSession()
    const [files, setFiles] = useState<MediaFile[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [editingFile, setEditingFile] = useState<string | null>(null)
    const [newName, setNewName] = useState("")
    const [viewMode, setViewMode] = useState<"grid" | "list">("list")

    const token = propToken || (session as any)?.accessToken

    const fetchFiles = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/radio/media", {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setFiles(data)
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => {
        if (token) fetchFiles()
    }, [token, fetchFiles])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setUploadProgress(0)

        const formData = new FormData()
        formData.append("broadcast_media", file)

        try {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/api/radio/broadcast/upload", true)
            xhr.setRequestHeader("Authorization", `Bearer ${token}`)

            xhr.upload.onprogress = (evt) => {
                if (evt.lengthComputable) {
                    const percentComplete = (evt.loaded / evt.total) * 100
                    setUploadProgress(percentComplete)
                }
            }

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    await fetchFiles()
                    setIsUploading(false)
                } else {
                    alert("Upload failed")
                    setIsUploading(false)
                }
            }

            xhr.onerror = () => {
                alert("Upload failed")
                setIsUploading(false)
            }

            xhr.send(formData)
        } catch (err) {
            console.error(err)
            setIsUploading(false)
        }
    }

    const handleRename = async (oldName: string) => {
        if (!newName || newName === oldName) {
            setEditingFile(null)
            return
        }

        try {
            const res = await fetch("/api/radio/media/rename", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ oldName, newName })
            })
            if (!res.ok) throw new Error("Rename failed")
            await fetchFiles()
            setEditingFile(null)
        } catch (err) {
            alert("Rename failed")
        }
    }

    const handleDelete = async (filename: string) => {
        if (!confirm(`Вы уверены, что хотите навсегда удалить ${filename}?`)) return

        try {
            const res = await fetch(`/api/radio/media/${filename}`, {
                method: "DELETE",
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Delete failed")
            await fetchFiles()
        } catch (err) {
            alert("Delete failed")
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full bg-[#050505] border border-[#1a1a1a] rounded-sm overflow-hidden text-[#e5e5e5]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#080808]">
                <div className="flex items-center gap-2">
                    <Music size={16} className="text-[#99CCCC]" />
                    <h2 className="text-xs font-bold uppercase tracking-widest">Медиатека</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" size={14} />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Поиск файлов..."
                            className="bg-black border border-[#1a1a1a] rounded-sm py-1.5 pl-9 pr-4 text-[10px] outline-none focus:border-[#99CCCC] transition-colors w-48 font-mono"
                        />
                    </div>
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-[#99CCCC] text-black text-[10px] font-bold rounded-sm hover:bg-white transition-all cursor-pointer shadow-lg disabled:opacity-50">
                        <Upload size={14} />
                        <span>ЗАГРУЗИТЬ</span>
                        <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
                    </label>
                    {onClose && (
                        <button onClick={onClose} className="text-[#444] hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Upload Progress */}
            {isUploading && (
                <div className="px-6 py-3 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center gap-4 animate-in slide-in-from-top duration-300">
                    <Loader2 size={14} className="text-[#99CCCC] animate-spin" />
                    <div className="flex-1">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-[#737373] mb-1">
                            <span>Загрузка файла...</span>
                            <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#99CCCC] transition-all duration-300 shadow-[0_0_10px_rgba(153,204,204,0.3)]"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 size={24} className="text-[#1a1a1a] animate-spin" />
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-[#444] space-y-2">
                        <div className="w-12 h-12 rounded-full border border-dashed border-[#1a1a1a] flex items-center justify-center">
                            <Music size={20} className="opacity-20" />
                        </div>
                        <p className="text-[10px] uppercase font-mono tracking-widest">Нет файлов</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredFiles.map((file) => (
                            <div
                                key={file.name}
                                className="group flex items-center gap-4 p-2.5 bg-black border border-transparent hover:border-[#99CCCC]/30 hover:bg-[#0a0a0a] rounded-sm transition-all"
                            >
                                <div className="w-8 h-8 rounded-sm bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center text-[#444] group-hover:text-[#99CCCC] transition-colors">
                                    <Music size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingFile === file.name ? (
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRename(file.name)
                                                    if (e.key === 'Escape') setEditingFile(null)
                                                }}
                                                className="flex-1 bg-black border border-[#99CCCC] rounded-sm px-2 py-0.5 text-xs text-white outline-none font-mono"
                                            />
                                            <button onClick={() => handleRename(file.name)} className="p-1 text-[#99CCCC] hover:text-white transition-colors">
                                                <Check size={14} />
                                            </button>
                                            <button onClick={() => setEditingFile(null)} className="p-1 text-red-500/50 hover:text-red-500 transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col truncate">
                                            <span className="text-[11px] font-bold text-white truncate group-hover:text-[#99CCCC] transition-colors font-mono">
                                                {file.name}
                                            </span>
                                            <div className="flex items-center gap-2 text-[9px] text-[#444] uppercase font-medium">
                                                <span>{formatSize(file.size)}</span>
                                                <span className="w-0.5 h-0.5 rounded-full bg-[#1a1a1a]"></span>
                                                <span>{new Date(file.mtime).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingFile(file.name)
                                            setNewName(file.name)
                                        }}
                                        className="p-1.5 text-[#444] hover:text-white hover:bg-[#1a1a1a] rounded-sm transition-all"
                                        title="Rename"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(file.name)}
                                        className="p-1.5 text-[#444] hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => onSelectFile?.(file.name)}
                                        className="ml-2 px-2 py-1 bg-[#1a1a1a] text-[#99CCCC] text-[8px] font-black uppercase rounded-sm hover:bg-[#99CCCC] hover:text-black transition-all shadow-md"
                                    >
                                        Добавить
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Stats */}
            <div className="px-4 py-2 bg-[#080808] border-t border-[#1a1a1a] flex justify-between items-center text-[8px] font-mono text-[#444] uppercase tracking-widest">
                <span>{filteredFiles.length} ФАЙЛОВ</span>
                <span>Итого: {formatSize(files.reduce((acc, f) => acc + f.size, 0))}</span>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #99CCCC/50; }
            `}</style>
        </div>
    )
}
