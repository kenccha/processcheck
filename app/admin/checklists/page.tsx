"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  getTemplateStages,
  getTemplateDepartments,
  subscribeTemplateItems,
  subscribeAllTemplateItems,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  reorderTemplateItems,
  addTemplateStage,
  deleteTemplateStage,
  addTemplateDepartment,
  deleteTemplateDepartment,
} from "@/lib/firestoreService";
import type { ChecklistTemplateStage, ChecklistTemplateDepartment, ChecklistTemplateItem } from "@/lib/types";

export default function ChecklistAdminPage() {
  const { currentUser, loading } = useRequireAuth();

  // DB 데이터 (6개 페이즈, 10개 부서)
  const [stages, setStages] = useState<ChecklistTemplateStage[]>([]);
  const [departments, setDepartments] = useState<ChecklistTemplateDepartment[]>([]);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);       // 선택된 페이즈+부서 항목
  const [allItems, setAllItems] = useState<ChecklistTemplateItem[]>([]); // 전체 항목
  const [dataLoading, setDataLoading] = useState(true);

  // 트리 뷰 상태
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // 편집 상태
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemContent, setNewItemContent] = useState("");
  const [newItemIsRequired, setNewItemIsRequired] = useState(true);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageWorkName, setNewStageWorkName] = useState("");
  const [newStageGateName, setNewStageGateName] = useState("");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 뷰 모드
  const [adminViewMode, setAdminViewMode] = useState<"tree" | "matrix" | "list">("tree");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [listFilterStage, setListFilterStage] = useState<string>("all");
  const [listFilterDept, setListFilterDept] = useState<string>("all");

  const itemsUnsubRef = useRef<(() => void) | null>(null);
  const allItemsUnsubRef = useRef<(() => void) | null>(null);

  // ─── 초기 데이터 로드 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([getTemplateStages(), getTemplateDepartments()])
      .then(([s, d]) => {
        setStages(s as ChecklistTemplateStage[]);
        setDepartments(d as ChecklistTemplateDepartment[]);
        if (s.length > 0) setExpandedStages(new Set([s[0].id]));
      })
      .finally(() => setDataLoading(false));
  }, [currentUser]);

  // 전체 템플릿 아이템 실시간 구독 (매트릭스/리스트 뷰 + 트리 카운트용)
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeAllTemplateItems((newItems) => {
      setAllItems(newItems);
    });
    allItemsUnsubRef.current = unsub;
    return () => {
      if (allItemsUnsubRef.current) {
        allItemsUnsubRef.current();
        allItemsUnsubRef.current = null;
      }
    };
  }, [currentUser]);

  // 선택된 페이즈+부서의 항목 실시간 구독 (트리 뷰 편집용)
  useEffect(() => {
    if (itemsUnsubRef.current) {
      itemsUnsubRef.current();
      itemsUnsubRef.current = null;
    }
    if (!selectedStageId || !selectedDeptId) {
      setItems([]);
      return;
    }
    const unsub = subscribeTemplateItems(selectedStageId, selectedDeptId, (newItems) => {
      setItems(newItems);
    });
    itemsUnsubRef.current = unsub;
    return () => {
      if (itemsUnsubRef.current) {
        itemsUnsubRef.current();
        itemsUnsubRef.current = null;
      }
    };
  }, [selectedStageId, selectedDeptId]);

  // ─── 권한 ──────────────────────────────────────────────────────────────────
  const canEdit = (departmentId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === "observer") return true;
    if (currentUser.role === "manager") {
      const dept = departments.find((d) => d.id === departmentId);
      return dept?.name === currentUser.department;
    }
    return false;
  };

  const canEditStage = () => {
    if (!currentUser) return false;
    return currentUser.role === "observer";
  };

  // ─── 트리 뷰 액션 ────────────────────────────────────────────────────────
  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const selectDepartment = (stageId: string, deptId: string) => {
    setSelectedStageId(stageId);
    setSelectedDeptId(deptId);
    setEditingItemId(null);
  };

  const startEditItem = (itemId: string, content: string) => {
    setEditingItemId(itemId);
    setEditingContent(content);
  };

  const saveEditItem = async () => {
    if (!editingItemId || !editingContent.trim()) return;
    try {
      setActionLoading(true);
      await updateTemplateItem(editingItemId, { content: editingContent.trim() });
      setEditingItemId(null);
      setEditingContent("");
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditingContent("");
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      setActionLoading(true);
      await deleteTemplateItem(itemId);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const moveItem = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const updates = reordered.map((item, i) => ({ id: item.id, order: i }));
    try {
      setActionLoading(true);
      await reorderTemplateItems(updates);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const saveNewItem = async () => {
    if (!newItemContent.trim() || !selectedStageId || !selectedDeptId || !currentUser) return;
    try {
      setActionLoading(true);
      await addTemplateItem({
        stageId: selectedStageId,
        departmentId: selectedDeptId,
        content: newItemContent.trim(),
        order: items.length,
        isRequired: newItemIsRequired,
        createdBy: currentUser.name,
        createdAt: new Date(),
        lastModifiedBy: currentUser.name,
        lastModifiedAt: new Date(),
      });
      setNewItemContent("");
      setNewItemIsRequired(true);
      setShowAddModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleItemRequired = async (item: ChecklistTemplateItem) => {
    try {
      await updateTemplateItem(item.id, { isRequired: !item.isRequired });
    } catch (e) {
      console.error(e);
    }
  };

  // ─── 드래그 앤 드롭 ────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };
  const handleDragLeave = () => setDragOverIndex(null);
  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItemId) return;
    const draggedIndex = items.findIndex((item) => item.id === draggedItemId);
    if (draggedIndex === targetIndex) { setDraggedItemId(null); setDragOverIndex(null); return; }
    const reordered = [...items];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const updates = reordered.map((item, i) => ({ id: item.id, order: i }));
    setDraggedItemId(null);
    setDragOverIndex(null);
    try { await reorderTemplateItems(updates); } catch (e) { console.error(e); }
  };
  const handleDragEnd = () => { setDraggedItemId(null); setDragOverIndex(null); };

  // ─── 페이즈/부서 추가·삭제 ────────────────────────────────────────────────
  const handleAddNewStage = async () => {
    if (!newStageName.trim() || !newStageWorkName.trim() || !newStageGateName.trim() || !currentUser) return;
    try {
      setActionLoading(true);
      const id = await addTemplateStage({
        name: newStageName.trim(),
        workStageName: newStageWorkName.trim(),
        gateStageName: newStageGateName.trim(),
        createdBy: currentUser.name,
      });
      const s = await getTemplateStages();
      setStages(s as ChecklistTemplateStage[]);
      setExpandedStages((prev) => new Set([...prev, id]));
      setNewStageName("");
      setNewStageWorkName("");
      setNewStageGateName("");
      setShowStageModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("이 페이즈를 삭제하시겠습니까? 페이즈에 속한 모든 항목도 삭제됩니다.")) return;
    try {
      setActionLoading(true);
      await deleteTemplateStage(stageId);
      const s = await getTemplateStages();
      setStages(s as ChecklistTemplateStage[]);
      if (selectedStageId === stageId) { setSelectedStageId(null); setSelectedDeptId(null); }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNewDepartment = async () => {
    if (!newDepartmentName.trim() || !currentUser) return;
    try {
      setActionLoading(true);
      await addTemplateDepartment({ name: newDepartmentName.trim(), createdBy: currentUser.name });
      const d = await getTemplateDepartments();
      setDepartments(d as ChecklistTemplateDepartment[]);
      setNewDepartmentName("");
      setShowDepartmentModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm("이 부서를 삭제하시겠습니까? 부서에 속한 모든 항목도 삭제됩니다.")) return;
    try {
      setActionLoading(true);
      await deleteTemplateDepartment(deptId);
      const d = await getTemplateDepartments();
      setDepartments(d as ChecklistTemplateDepartment[]);
      if (selectedDeptId === deptId) { setSelectedDeptId(null); setSelectedStageId(null); }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 뷰 전환 ──────────────────────────────────────────────────────────────
  const navigateToTreeCell = (stageId: string, deptId: string) => {
    setAdminViewMode("tree");
    setSelectedStageId(stageId);
    setSelectedDeptId(deptId);
    setExpandedStages((prev) => new Set([...prev, stageId]));
  };

  // ─── 파생 데이터 ──────────────────────────────────────────────────────────
  const filteredListItems = useMemo(() => {
    let filtered = allItems;
    if (listFilterStage !== "all") {
      filtered = filtered.filter((item) => item.stageId === listFilterStage);
    }
    if (listFilterDept !== "all") {
      filtered = filtered.filter((item) => item.departmentId === listFilterDept);
    }
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.trim().toLowerCase();
      filtered = filtered.filter((item) => item.content.toLowerCase().includes(q));
    }
    return filtered;
  }, [allItems, listFilterStage, listFilterDept, listSearchQuery]);

  // 매트릭스: 페이즈(stages) × 부서별 항목 수
  const matrixData = useMemo(() => {
    return stages.map((stage) => {
      const deptCounts = departments.map((dept) => {
        const count = allItems.filter(
          (item) => item.stageId === stage.id && item.departmentId === dept.id
        ).length;
        const requiredCount = allItems.filter(
          (item) => item.stageId === stage.id && item.departmentId === dept.id && item.isRequired
        ).length;
        return { deptId: dept.id, count, requiredCount };
      });
      return { stage, deptCounts };
    });
  }, [stages, departments, allItems]);

  const selectedStage = stages.find((s) => s.id === selectedStageId);
  const selectedDept = departments.find((d) => d.id === selectedDeptId);
  const getStageName = (stageId: string) => stages.find((s) => s.id === stageId)?.name ?? stageId;
  const getDeptName = (deptId: string) => departments.find((d) => d.id === deptId)?.name ?? deptId;

  // ─── 렌더링 ────────────────────────────────────────────────────────────────

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight mb-1">
              체크리스트 관리
            </h1>
            <p className="text-slate-400">
              프로젝트 페이즈별, 부서별 체크리스트를 관리합니다.
              <span className="text-slate-500 ml-2 font-mono text-xs">
                총 {allItems.length}개 항목
              </span>
            </p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-2 border border-surface-3 rounded-xl p-1">
            {([
              { mode: "tree" as const, label: "트리", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              )},
              { mode: "matrix" as const, label: "매트릭스", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              )},
              { mode: "list" as const, label: "리스트", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              )},
            ]).map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => setAdminViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  adminViewMode === mode
                    ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-surface-3 border border-transparent"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : adminViewMode === "tree" ? (
          /* ════ TREE VIEW ════ */
          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel */}
            <div className="col-span-4 bg-surface-2 border border-surface-3 rounded-2xl p-5 h-[calc(100vh-200px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-surface-3">
                <h3 className="font-semibold text-slate-200 text-sm uppercase tracking-wider">페이즈 및 부서</h3>
                {canEditStage() && (
                  <div className="flex items-center space-x-1">
                    <button onClick={() => setShowDepartmentModal(true)} className="btn-ghost p-1.5" title="부서 추가">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </button>
                    <button onClick={() => setShowStageModal(true)} className="btn-ghost p-1.5" title="페이즈 추가">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {stages.map((stage) => (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between group">
                      <button
                        onClick={() => toggleStage(stage.id)}
                        className="flex-1 flex items-center space-x-2 p-2.5 hover:bg-surface-3 rounded-lg transition-colors"
                      >
                        <span className="text-slate-500 text-xs w-4 text-center">
                          {expandedStages.has(stage.id) ? "\u25BC" : "\u25B6"}
                        </span>
                        <span className="font-medium text-slate-200 text-sm">{stage.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {stage.workStageName}/{stage.gateStageName}
                        </span>
                      </button>
                      {canEditStage() && (
                        <button
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-1 text-danger-400 hover:bg-danger-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="페이즈 삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>

                    {expandedStages.has(stage.id) && (
                      <div className="ml-6 mt-1 space-y-0.5">
                        {departments.map((dept) => {
                          const isSelected = selectedStageId === stage.id && selectedDeptId === dept.id;
                          const hasEditPermission = canEdit(dept.id);
                          const cellCount = allItems.filter(
                            (item) => item.stageId === stage.id && item.departmentId === dept.id
                          ).length;
                          return (
                            <div key={dept.id} className="flex items-center group">
                              <button
                                onClick={() => selectDepartment(stage.id, dept.id)}
                                className={`flex-1 flex items-center justify-between p-2 rounded-lg transition-colors ${
                                  isSelected
                                    ? "bg-primary-500/10 border border-primary-500/30"
                                    : "hover:bg-surface-3 border border-transparent"
                                } ${!hasEditPermission ? "opacity-50" : ""}`}
                              >
                                <span className={`text-sm ${isSelected ? "text-primary-300 font-medium" : "text-slate-400"}`}>
                                  {dept.name}
                                </span>
                                {cellCount > 0 && (
                                  <span className="text-xs font-mono text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded">
                                    {cellCount}
                                  </span>
                                )}
                              </button>
                              {canEditStage() && (
                                <button
                                  onClick={() => handleDeleteDepartment(dept.id)}
                                  className="p-1 text-danger-400 hover:bg-danger-500/10 rounded opacity-0 group-hover:opacity-100 transition-all ml-1"
                                  title="부서 삭제"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel - Editor */}
            <div className="col-span-8 bg-surface-2 border border-surface-3 rounded-2xl p-6 h-[calc(100vh-200px)] overflow-y-auto">
              {selectedStageId && selectedDeptId ? (
                <>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-surface-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                        <span>{selectedStage?.name}</span>
                        <span className="text-slate-500">&gt;</span>
                        <span className="text-primary-400">{selectedDept?.name}</span>
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {items.length}개 항목
                        {selectedStage && (
                          <span className="ml-2 font-mono text-[10px] text-slate-600">
                            ({selectedStage.workStageName} + {selectedStage.gateStageName})
                          </span>
                        )}
                        {!canEdit(selectedDeptId) && (
                          <span className="badge-warning ml-2 text-[10px]">읽기 전용</span>
                        )}
                      </p>
                    </div>
                    {canEdit(selectedDeptId) && (
                      <button onClick={() => setShowAddModal(true)} className="btn-primary">+ 항목 추가</button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <div className="text-center py-16 text-slate-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        체크 항목이 없습니다. 항목을 추가해주세요.
                      </div>
                    ) : (
                      items.map((item, index) => {
                        const hasEditPermission = canEdit(selectedDeptId);
                        return (
                          <div
                            key={item.id}
                            draggable={editingItemId !== item.id && hasEditPermission}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-start space-x-3 p-4 rounded-xl transition-all ${
                              draggedItemId === item.id ? "opacity-50 border border-primary-500/50 bg-surface-1"
                              : dragOverIndex === index ? "border border-primary-500/50 bg-primary-500/5"
                              : "bg-surface-1 border border-surface-3 hover:border-surface-4"
                            } ${editingItemId !== item.id && hasEditPermission ? "cursor-move" : ""} ${!hasEditPermission ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-center space-x-1.5 min-w-[48px] pt-0.5">
                              {editingItemId !== item.id && hasEditPermission && (
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" /></svg>
                              )}
                              <span className="text-slate-500 font-mono text-sm">{index + 1}.</span>
                            </div>

                            {editingItemId === item.id ? (
                              <div className="flex-1">
                                <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="input-field w-full" rows={2} />
                                <div className="flex items-center space-x-2 mt-3">
                                  <button onClick={saveEditItem} disabled={actionLoading} className="btn-primary text-sm px-3 py-1.5">저장</button>
                                  <button onClick={cancelEditItem} className="btn-secondary text-sm px-3 py-1.5">취소</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-200 leading-relaxed">{item.content}</p>
                                  <div className="flex items-center space-x-2 mt-2">
                                    <button
                                      onClick={() => toggleItemRequired(item)}
                                      disabled={!hasEditPermission}
                                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-opacity ${hasEditPermission ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed"} ${item.isRequired ? "badge-danger" : "badge-neutral"}`}
                                    >
                                      {item.isRequired ? "필수" : "선택"}
                                    </button>
                                  </div>
                                </div>
                                {hasEditPermission && (
                                  <div className="flex items-center space-x-0.5 shrink-0">
                                    <button onClick={() => moveItem(index, "up")} disabled={index === 0 || actionLoading} className="p-1.5 text-slate-500 hover:text-slate-300 disabled:text-slate-700 disabled:cursor-not-allowed rounded hover:bg-surface-3 transition-colors" title="위로">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                                    </button>
                                    <button onClick={() => moveItem(index, "down")} disabled={index === items.length - 1 || actionLoading} className="p-1.5 text-slate-500 hover:text-slate-300 disabled:text-slate-700 disabled:cursor-not-allowed rounded hover:bg-surface-3 transition-colors" title="아래로">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    <button onClick={() => startEditItem(item.id, item.content)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded hover:bg-surface-3 transition-colors" title="수정">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded transition-colors" title="삭제">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {canEdit(selectedDeptId) && items.length > 0 && (
                    <div className="flex items-center justify-end space-x-3 mt-8 pt-5 border-t border-surface-3">
                      <p className="text-sm text-slate-500 flex-1">변경사항은 자동으로 저장됩니다.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <svg className="w-16 h-16 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  좌측에서 페이즈와 부서를 선택해주세요.
                </div>
              )}
            </div>
          </div>
        ) : adminViewMode === "matrix" ? (
          /* ════ MATRIX VIEW ════ */
          <div className="bg-surface-2 border border-surface-3 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-1">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-3 sticky left-0 bg-surface-1 z-10 min-w-[140px]">
                      페이즈
                    </th>
                    {departments.map((dept) => (
                      <th key={dept.id} className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-3 min-w-[90px]">
                        {dept.name}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-surface-3 min-w-[60px]">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map(({ stage, deptCounts }, idx) => {
                    const rowTotal = deptCounts.reduce((sum, d) => sum + d.count, 0);
                    return (
                      <tr key={stage.id} className={`${idx % 2 === 0 ? "bg-surface-2" : "bg-surface-1/50"} hover:bg-surface-3/50 transition-colors`}>
                        <td className="px-4 py-3 border-b border-surface-3 sticky left-0 z-10" style={{ backgroundColor: "inherit" }}>
                          <div>
                            <span className="font-medium text-slate-200 text-sm">{stage.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2">
                              {stage.workStageName}/{stage.gateStageName}
                            </span>
                          </div>
                        </td>
                        {deptCounts.map((dc) => (
                          <td key={dc.deptId} className="text-center px-3 py-3 border-b border-surface-3">
                            {dc.count > 0 ? (
                              <button
                                onClick={() => navigateToTreeCell(stage.id, dc.deptId)}
                                className="inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 hover:border-primary-500/40 transition-all cursor-pointer group"
                              >
                                <span className="text-sm font-semibold text-primary-300 group-hover:text-primary-200">{dc.count}</span>
                                {dc.requiredCount > 0 && (
                                  <span className="text-[10px] text-danger-400 font-mono">필수 {dc.requiredCount}</span>
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-600 text-sm">—</span>
                            )}
                          </td>
                        ))}
                        <td className="text-center px-3 py-3 border-b border-surface-3">
                          <span className={`font-mono text-sm font-semibold ${rowTotal > 0 ? "text-slate-300" : "text-slate-600"}`}>{rowTotal}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-surface-1 border-t-2 border-surface-3">
                    <td className="px-4 py-3 sticky left-0 bg-surface-1 z-10">
                      <span className="font-semibold text-slate-300 text-sm">합계</span>
                    </td>
                    {departments.map((dept) => {
                      const colTotal = allItems.filter((item) => item.departmentId === dept.id).length;
                      return (
                        <td key={dept.id} className="text-center px-3 py-3">
                          <span className={`font-mono text-sm font-semibold ${colTotal > 0 ? "text-slate-300" : "text-slate-600"}`}>{colTotal}</span>
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-3">
                      <span className="font-mono text-sm font-bold text-primary-400">{allItems.length}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-surface-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-primary-500/20 border border-primary-500/30" />
                클릭하면 트리 뷰에서 편집
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-danger-400 font-mono">필수 N</span>
                필수 항목 수
              </span>
            </div>
          </div>
        ) : (
          /* ════ LIST VIEW ════ */
          <div className="bg-surface-2 border border-surface-3 rounded-2xl">
            <div className="px-5 py-4 border-b border-surface-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input type="text" value={listSearchQuery} onChange={(e) => setListSearchQuery(e.target.value)} placeholder="항목 검색..." className="input-field w-full pl-9" />
                </div>
              </div>
              <select value={listFilterStage} onChange={(e) => setListFilterStage(e.target.value)} className="input-field text-sm">
                <option value="all">모든 페이즈</option>
                {stages.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <select value={listFilterDept} onChange={(e) => setListFilterDept(e.target.value)} className="input-field text-sm">
                <option value="all">모든 부서</option>
                {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
              <span className="text-xs font-mono text-slate-500">{filteredListItems.length}/{allItems.length}</span>
            </div>

            <div className="max-h-[calc(100vh-300px)] overflow-y-auto divide-y divide-surface-3">
              {filteredListItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  검색 결과가 없습니다.
                </div>
              ) : (
                filteredListItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-3/50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm leading-relaxed">{item.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-mono text-slate-500 bg-surface-3 px-2 py-0.5 rounded">{getStageName(item.stageId)}</span>
                        <span className="text-[11px] font-mono text-slate-500 bg-surface-3 px-2 py-0.5 rounded">{getDeptName(item.departmentId)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.isRequired ? "badge-danger" : "badge-neutral"}`}>
                          {item.isRequired ? "필수" : "선택"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigateToTreeCell(item.stageId, item.departmentId)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-primary-400 hover:bg-surface-3 rounded-lg"
                      title="트리 뷰에서 편집"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ════ MODALS ════ */}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-surface-3 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-100 mb-5">새 체크리스트 항목 추가</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">항목 내용 <span className="text-danger-400">*</span></label>
                <textarea value={newItemContent} onChange={(e) => setNewItemContent(e.target.value)} placeholder="예: NABC 문서가 작성되었는가?" className="input-field w-full" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">유형</label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center cursor-pointer group">
                    <input type="radio" checked={newItemIsRequired} onChange={() => setNewItemIsRequired(true)} className="mr-2 accent-primary-500" />
                    <span className="text-sm text-slate-300 group-hover:text-slate-200">필수</span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input type="radio" checked={!newItemIsRequired} onChange={() => setNewItemIsRequired(false)} className="mr-2 accent-primary-500" />
                    <span className="text-sm text-slate-300 group-hover:text-slate-200">선택</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-surface-3">
              <button onClick={() => { setShowAddModal(false); setNewItemContent(""); setNewItemIsRequired(true); }} className="btn-ghost">취소</button>
              <button onClick={saveNewItem} disabled={actionLoading || !newItemContent.trim()} className="btn-primary disabled:opacity-50">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Phase Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-surface-3 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-100 mb-5">새 페이즈 추가</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">페이즈 이름 <span className="text-danger-400">*</span></label>
                <input type="text" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="예: 사후관리" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">작업 단계명 <span className="text-danger-400">*</span></label>
                <input type="text" value={newStageWorkName} onChange={(e) => setNewStageWorkName(e.target.value)} placeholder="예: 사후관리검토" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">승인 단계명 <span className="text-danger-400">*</span></label>
                <input type="text" value={newStageGateName} onChange={(e) => setNewStageGateName(e.target.value)} placeholder="예: 사후관리승인" className="input-field w-full" />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-surface-3">
              <button onClick={() => { setShowStageModal(false); setNewStageName(""); setNewStageWorkName(""); setNewStageGateName(""); }} className="btn-ghost">취소</button>
              <button onClick={handleAddNewStage} disabled={actionLoading || !newStageName.trim() || !newStageWorkName.trim() || !newStageGateName.trim()} className="btn-primary disabled:opacity-50">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-2 border border-surface-3 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-100 mb-5">새 부서 추가</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">부서 이름 <span className="text-danger-400">*</span></label>
                <input type="text" value={newDepartmentName} onChange={(e) => setNewDepartmentName(e.target.value)} placeholder="예: 마케팅팀" className="input-field w-full" />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-surface-3">
              <button onClick={() => { setShowDepartmentModal(false); setNewDepartmentName(""); }} className="btn-ghost">취소</button>
              <button onClick={handleAddNewDepartment} disabled={actionLoading || !newDepartmentName.trim()} className="btn-primary disabled:opacity-50">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
