"use client";

import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  getTemplateStages,
  getTemplateDepartments,
  subscribeTemplateItems,
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

  const [stages, setStages] = useState<ChecklistTemplateStage[]>([]);
  const [departments, setDepartments] = useState<ChecklistTemplateDepartment[]>([]);
  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

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
  const [newStageType, setNewStageType] = useState<"work" | "gate">("work");
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const itemsUnsubRef = useRef<(() => void) | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([getTemplateStages(), getTemplateDepartments()])
      .then(([s, d]) => {
        setStages(s as ChecklistTemplateStage[]);
        setDepartments(d as ChecklistTemplateDepartment[]);
        // 첫 번째 단계 자동 확장
        if (s.length > 0) setExpandedStages(new Set([s[0].id]));
      })
      .finally(() => setDataLoading(false));
  }, [currentUser]);

  // 선택된 단계+부서의 항목 실시간 구독
  useEffect(() => {
    // 이전 구독 해제
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

  const canEdit = (departmentId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === "pm" || currentUser.role === "scheduler") return true;
    if (currentUser.role === "manager") {
      const dept = departments.find((d) => d.id === departmentId);
      return dept?.name === currentUser.department;
    }
    return false;
  };

  const canEditStage = () => {
    if (!currentUser) return false;
    return currentUser.role === "pm" || currentUser.role === "scheduler";
  };

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
    if (draggedIndex === targetIndex) {
      setDraggedItemId(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const updates = reordered.map((item, i) => ({ id: item.id, order: i }));
    setDraggedItemId(null);
    setDragOverIndex(null);
    try {
      await reorderTemplateItems(updates);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverIndex(null);
  };

  const handleAddNewStage = async () => {
    if (!newStageName.trim() || !currentUser) return;
    try {
      setActionLoading(true);
      const id = await addTemplateStage({
        name: newStageName.trim(),
        type: newStageType,
        createdBy: currentUser.name,
      });
      // Refresh stages
      const s = await getTemplateStages();
      setStages(s as ChecklistTemplateStage[]);
      setExpandedStages((prev) => new Set([...prev, id]));
      setNewStageName("");
      setNewStageType("work");
      setShowStageModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("이 단계를 삭제하시겠습니까? 단계에 속한 모든 항목도 삭제됩니다.")) return;
    try {
      setActionLoading(true);
      await deleteTemplateStage(stageId);
      const s = await getTemplateStages();
      setStages(s as ChecklistTemplateStage[]);
      if (selectedStageId === stageId) {
        setSelectedStageId(null);
        setSelectedDeptId(null);
      }
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
      if (selectedDeptId === deptId) {
        setSelectedDeptId(null);
        setSelectedStageId(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const selectedStage = stages.find((s) => s.id === selectedStageId);
  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">체크리스트 관리</h1>
          <p className="text-gray-600">프로젝트 단계별, 부서별 체크리스트를 관리합니다.</p>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* 좌측 트리 */}
            <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-4 h-[calc(100vh-200px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">단계 및 부서</h3>
                {canEditStage() && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowDepartmentModal(true)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="부서 추가"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowStageModal(true)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="단계 추가"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {stages.map((stage) => (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between group">
                      <button
                        onClick={() => toggleStage(stage.id)}
                        className="flex-1 flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <span className="text-gray-600">{expandedStages.has(stage.id) ? "▼" : "▶"}</span>
                        <span className="font-medium text-gray-900 text-sm">{stage.name}</span>
                        {stage.type === "gate" && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">게이트</span>
                        )}
                      </button>
                      {canEditStage() && (
                        <button
                          onClick={() => handleDeleteStage(stage.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="단계 삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {expandedStages.has(stage.id) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {departments.map((dept) => {
                          const isSelected = selectedStageId === stage.id && selectedDeptId === dept.id;
                          const hasEditPermission = canEdit(dept.id);
                          return (
                            <div key={dept.id} className="flex items-center group">
                              <button
                                onClick={() => selectDepartment(stage.id, dept.id)}
                                className={`flex-1 flex items-center justify-between p-2 rounded-lg transition-colors ${
                                  isSelected ? "bg-primary-50 border border-primary-300" : "hover:bg-gray-50"
                                } ${!hasEditPermission ? "opacity-50" : ""}`}
                              >
                                <span className={`text-sm ${isSelected ? "text-primary-700 font-medium" : "text-gray-700"}`}>
                                  {dept.name}
                                </span>
                              </button>
                              {canEditStage() && (
                                <button
                                  onClick={() => handleDeleteDepartment(dept.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                  title="부서 삭제"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
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

            {/* 우측 편집 영역 */}
            <div className="col-span-8 bg-white rounded-xl border border-gray-200 p-6 h-[calc(100vh-200px)] overflow-y-auto">
              {selectedStageId && selectedDeptId ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedStage?.name} &gt; {selectedDept?.name}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {items.length}개 항목
                        {!canEdit(selectedDeptId) && (
                          <span className="ml-2 text-xs text-warning-600 bg-warning-50 px-2 py-0.5 rounded">읽기 전용</span>
                        )}
                      </p>
                    </div>
                    {canEdit(selectedDeptId) && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        + 항목 추가
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
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
                            className={`flex items-start space-x-3 p-4 border rounded-lg transition-all ${
                              draggedItemId === item.id
                                ? "opacity-50 border-primary-400"
                                : dragOverIndex === index
                                ? "border-primary-400 bg-primary-50"
                                : "border-gray-200 hover:border-gray-300"
                            } ${editingItemId !== item.id && hasEditPermission ? "cursor-move" : ""} ${
                              !hasEditPermission ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex items-center space-x-1 min-w-[48px]">
                              {editingItemId !== item.id && hasEditPermission && (
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
                                </svg>
                              )}
                              <span className="text-gray-500 font-medium">{index + 1}.</span>
                            </div>

                            {editingItemId === item.id ? (
                              <div className="flex-1">
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  rows={2}
                                />
                                <div className="flex items-center space-x-2 mt-2">
                                  <button
                                    onClick={saveEditItem}
                                    disabled={actionLoading}
                                    className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-60"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={cancelEditItem}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex-1">
                                  <p className="text-gray-900">{item.content}</p>
                                  <div className="flex items-center space-x-2 mt-2">
                                    <button
                                      onClick={() => toggleItemRequired(item)}
                                      disabled={!hasEditPermission}
                                      className={`text-xs px-2 py-0.5 rounded transition-opacity ${
                                        hasEditPermission ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed"
                                      } ${item.isRequired ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}
                                    >
                                      {item.isRequired ? "필수" : "선택"}
                                    </button>
                                  </div>
                                </div>
                                {hasEditPermission && (
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => moveItem(index, "up")}
                                      disabled={index === 0 || actionLoading}
                                      className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                      title="위로"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => moveItem(index, "down")}
                                      disabled={index === items.length - 1 || actionLoading}
                                      className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                      title="아래로"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => startEditItem(item.id, item.content)}
                                      className="p-1 text-gray-600 hover:text-gray-900"
                                      title="수정"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 text-red-600 hover:text-red-800"
                                      title="삭제"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
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
                    <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                      <p className="text-sm text-gray-500 flex-1">
                        변경사항은 자동으로 저장됩니다.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  좌측에서 단계와 부서를 선택해주세요.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 항목 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">새 체크리스트 항목 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  항목 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  placeholder="예: NABC 문서가 작성되었는가?"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={newItemIsRequired} onChange={() => setNewItemIsRequired(true)} className="mr-2" />
                    <span className="text-sm text-gray-700">필수</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={!newItemIsRequired} onChange={() => setNewItemIsRequired(false)} className="mr-2" />
                    <span className="text-sm text-gray-700">선택</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setNewItemContent(""); setNewItemIsRequired(true); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveNewItem}
                disabled={actionLoading || !newItemContent.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 단계 추가 모달 */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">새 단계 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단계 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="예: 12. 사후 관리"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">단계 유형</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={newStageType === "work"} onChange={() => setNewStageType("work")} className="mr-2" />
                    <span className="text-sm text-gray-700">작업 단계</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={newStageType === "gate"} onChange={() => setNewStageType("gate")} className="mr-2" />
                    <span className="text-sm text-gray-700">게이트 미팅</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => { setShowStageModal(false); setNewStageName(""); setNewStageType("work"); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddNewStage}
                disabled={actionLoading || !newStageName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 부서 추가 모달 */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">새 부서 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  부서 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="예: 마케팅팀"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => { setShowDepartmentModal(false); setNewDepartmentName(""); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddNewDepartment}
                disabled={actionLoading || !newDepartmentName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
