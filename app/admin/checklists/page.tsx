"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// 임시 데이터
const mockStages = [
  { id: "stage-0", name: "0. 발의 검토", order: 0, type: "work" as const },
  { id: "stage-1", name: "1. 발의 승인", order: 1, type: "gate" as const },
  { id: "stage-2", name: "2. 기획 검토", order: 2, type: "work" as const },
  { id: "stage-3", name: "3. 기획 승인", order: 3, type: "gate" as const },
  { id: "stage-4", name: "4. W/M 제작", order: 4, type: "work" as const },
  { id: "stage-5", name: "5. W/M 승인회", order: 5, type: "gate" as const },
  { id: "stage-6", name: "6. Tx 단계", order: 6, type: "work" as const },
  { id: "stage-7", name: "7. Tx 승인회", order: 7, type: "gate" as const },
  { id: "stage-8", name: "8. Master Gate Pilot", order: 8, type: "work" as const },
  { id: "stage-9", name: "9. MSG 승인회", order: 9, type: "gate" as const },
  { id: "stage-10", name: "10. 양산", order: 10, type: "work" as const },
  { id: "stage-11", name: "11. 영업 이관", order: 11, type: "work" as const },
];

const mockDepartments = [
  { id: "dept-dev", name: "개발팀", order: 0 },
  { id: "dept-quality", name: "품질팀", order: 1 },
  { id: "dept-sales", name: "영업팀", order: 2 },
  { id: "dept-mfg", name: "제조팀", order: 3 },
  { id: "dept-purchase", name: "구매팀", order: 4 },
  { id: "dept-cs", name: "CS팀", order: 5 },
  { id: "dept-mgmt", name: "경영관리팀", order: 6 },
  { id: "dept-clinical", name: "글로벌임상팀", order: 7 },
  { id: "dept-design", name: "디자인연구소", order: 8 },
  { id: "dept-cert", name: "인증팀", order: 9 },
];

const mockItems: { [key: string]: any[] } = {
  "stage-0_dept-dev": [
    {
      id: "item-1",
      content: "NABC 문서가 작성되었는가?",
      order: 0,
      isRequired: true,
    },
    {
      id: "item-2",
      content: "Needs(필요성) 항목이 작성되었는가?",
      order: 1,
      isRequired: true,
    },
  ],
  "stage-0_dept-sales": [
    {
      id: "item-3",
      content: "시장 니즈 조사 자료가 있는가?",
      order: 0,
      isRequired: true,
    },
  ],
};

export default function ChecklistAdminPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>("");
  const [userDepartment, setUserDepartment] = useState<string>("");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["stage-0"]));
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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

  useEffect(() => {
    // 권한 체크
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      router.push("/");
      return;
    }
    const user = JSON.parse(userStr);
    setUserRole(user.role);
    setUserDepartment(user.department);
  }, [router]);

  // 권한 체크 함수
  const canEdit = (departmentId: string) => {
    // 시스템 관리자나 PM은 모든 부서 편집 가능
    if (userRole === "pm" || userRole === "scheduler") {
      return true;
    }
    // 부서 관리자는 자기 부서만 편집 가능
    if (userRole === "manager") {
      const dept = mockDepartments.find((d) => d.id === departmentId);
      return dept?.name === userDepartment;
    }
    // 실무자는 편집 불가
    return false;
  };

  const canEditStage = () => {
    // 시스템 관리자나 PM만 단계 추가/삭제 가능
    return userRole === "pm" || userRole === "scheduler";
  };

  const toggleStage = (stageId: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stageId)) {
      newExpanded.delete(stageId);
    } else {
      newExpanded.add(stageId);
    }
    setExpandedStages(newExpanded);
  };

  const toggleDepartment = (key: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedDepartments(newExpanded);
  };

  const selectDepartment = (stageId: string, deptId: string) => {
    const key = `${stageId}_${deptId}`;
    setSelectedKey(key);
  };

  const getItemsForKey = (key: string) => {
    return mockItems[key] || [];
  };

  const startEditItem = (itemId: string, content: string) => {
    setEditingItemId(itemId);
    setEditingContent(content);
  };

  const saveEditItem = () => {
    // 저장 로직 (추후 Firestore 연동)
    console.log("Save item:", editingItemId, editingContent);
    setEditingItemId(null);
    setEditingContent("");
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditingContent("");
  };

  const deleteItem = (itemId: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      // 삭제 로직 (추후 Firestore 연동)
      console.log("Delete item:", itemId);
    }
  };

  const moveItemUp = (key: string, index: number) => {
    if (index === 0) return;
    // 순서 변경 로직 (추후 구현)
    console.log("Move up:", key, index);
  };

  const moveItemDown = (key: string, index: number, totalCount: number) => {
    if (index === totalCount - 1) return;
    // 순서 변경 로직 (추후 구현)
    console.log("Move down:", key, index);
  };

  const addNewItem = () => {
    if (!selectedKey) return;
    setShowAddModal(true);
  };

  const saveNewItem = () => {
    if (!newItemContent.trim()) {
      alert("항목 내용을 입력해주세요.");
      return;
    }
    // 새 항목 추가 로직 (추후 Firestore 연동)
    console.log("Add new item:", {
      key: selectedKey,
      content: newItemContent,
      isRequired: newItemIsRequired,
    });
    // 초기화
    setNewItemContent("");
    setNewItemIsRequired(true);
    setShowAddModal(false);
  };

  const toggleItemRequired = (itemId: string) => {
    // 필수/선택 토글 로직 (추후 Firestore 연동)
    console.log("Toggle required:", itemId);
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

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedItemId || !selectedKey) return;

    // 드래그한 아이템과 타겟 위치 찾기
    const items = getItemsForKey(selectedKey);
    const draggedIndex = items.findIndex((item) => item.id === draggedItemId);

    if (draggedIndex === targetIndex) {
      setDraggedItemId(null);
      setDragOverIndex(null);
      return;
    }

    // 순서 변경 로직 (추후 Firestore 연동)
    console.log("Reorder:", {
      from: draggedIndex,
      to: targetIndex,
      itemId: draggedItemId,
    });

    setDraggedItemId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverIndex(null);
  };

  const addNewStage = () => {
    if (!newStageName.trim()) {
      alert("단계 이름을 입력해주세요.");
      return;
    }
    // 새 단계 추가 로직 (추후 Firestore 연동)
    console.log("Add new stage:", { name: newStageName, type: newStageType });
    setNewStageName("");
    setNewStageType("work");
    setShowStageModal(false);
  };

  const deleteStage = (stageId: string) => {
    if (confirm("이 단계를 삭제하시겠습니까? 단계에 속한 모든 항목도 삭제됩니다.")) {
      // 단계 삭제 로직 (추후 Firestore 연동)
      console.log("Delete stage:", stageId);
    }
  };

  const addNewDepartment = () => {
    if (!newDepartmentName.trim()) {
      alert("부서 이름을 입력해주세요.");
      return;
    }
    // 새 부서 추가 로직 (추후 Firestore 연동)
    console.log("Add new department:", newDepartmentName);
    setNewDepartmentName("");
    setShowDepartmentModal(false);
  };

  const deleteDepartment = (deptId: string) => {
    if (confirm("이 부서를 삭제하시겠습니까? 부서에 속한 모든 항목도 삭제됩니다.")) {
      // 부서 삭제 로직 (추후 Firestore 연동)
      console.log("Delete department:", deptId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PC</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">
                  ProcessCheck
                </span>
              </div>
              <div className="hidden md:flex space-x-6">
                <a
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  대시보드
                </a>
                <a
                  href="/projects"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  프로젝트
                </a>
                <a
                  href="/admin/checklists"
                  className="text-primary-600 font-medium border-b-2 border-primary-600 pb-1"
                >
                  체크리스트 관리
                </a>
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              ← 돌아가기
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            체크리스트 관리
          </h1>
          <p className="text-gray-600">
            프로젝트 단계별, 부서별 체크리스트를 관리합니다.
          </p>
        </div>

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
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowStageModal(true)}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="단계 추가"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {mockStages.map((stage) => (
                <div key={stage.id}>
                  {/* 단계 */}
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className="flex-1 flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <span className="text-gray-600">
                        {expandedStages.has(stage.id) ? "▼" : "▶"}
                      </span>
                      <span className="font-medium text-gray-900">
                        {stage.name}
                      </span>
                      {stage.type === "gate" && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          게이트
                        </span>
                      )}
                    </button>
                    {canEditStage() && (
                      <button
                        onClick={() => deleteStage(stage.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="단계 삭제"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* 부서 목록 */}
                  {expandedStages.has(stage.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {mockDepartments.map((dept) => {
                        const key = `${stage.id}_${dept.id}`;
                        const items = getItemsForKey(key);
                        const isSelected = selectedKey === key;
                        const hasEditPermission = canEdit(dept.id);

                        return (
                          <div key={dept.id} className="flex items-center group">
                            <button
                              onClick={() => selectDepartment(stage.id, dept.id)}
                              className={`flex-1 flex items-center justify-between p-2 rounded-lg transition-colors ${
                                isSelected
                                  ? "bg-primary-50 border border-primary-300"
                                  : "hover:bg-gray-50"
                              } ${!hasEditPermission ? "opacity-50" : ""}`}
                            >
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`text-sm ${
                                    isSelected
                                      ? "text-primary-700 font-medium"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {dept.name}
                                </span>
                              </div>
                              {items.length > 0 && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {items.length}
                                </span>
                              )}
                            </button>
                            {canEditStage() && (
                              <button
                                onClick={() => deleteDepartment(dept.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                title="부서 삭제"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
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
            {selectedKey ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {mockStages.find((s) => selectedKey.startsWith(s.id))?.name} &gt;{" "}
                      {
                        mockDepartments.find((d) =>
                          selectedKey.endsWith(d.id)
                        )?.name
                      }
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {getItemsForKey(selectedKey).length}개 항목
                      {!canEdit(selectedKey.split("_")[1]) && (
                        <span className="ml-2 text-xs text-warning-600 bg-warning-50 px-2 py-0.5 rounded">
                          읽기 전용
                        </span>
                      )}
                    </p>
                  </div>
                  {canEdit(selectedKey.split("_")[1]) && (
                    <button
                      onClick={addNewItem}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      + 항목 추가
                    </button>
                  )}
                </div>

                {/* 체크리스트 항목 목록 */}
                <div className="space-y-3">
                  {getItemsForKey(selectedKey).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      체크 항목이 없습니다. 항목을 추가해주세요.
                    </div>
                  ) : (
                    getItemsForKey(selectedKey).map((item, index) => {
                      const hasEditPermission = canEdit(selectedKey.split("_")[1]);
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
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 8h16M4 16h16"
                              />
                            </svg>
                          )}
                          <span className="text-gray-500 font-medium">
                            {index + 1}.
                          </span>
                        </div>

                        {editingItemId === item.id ? (
                          /* 편집 모드 */
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
                                className="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
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
                          /* 보기 모드 */
                          <>
                            <div className="flex-1">
                              <p className="text-gray-900">{item.content}</p>
                              <div className="flex items-center space-x-2 mt-2">
                                <button
                                  onClick={() => toggleItemRequired(item.id)}
                                  disabled={!hasEditPermission}
                                  className={`text-xs px-2 py-0.5 rounded transition-opacity ${
                                    hasEditPermission ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed"
                                  } ${
                                    item.isRequired
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {item.isRequired ? "필수" : "선택"}
                                </button>
                              </div>
                            </div>
                            {hasEditPermission && <div className="flex items-center space-x-1">
                              <button
                                onClick={() =>
                                  moveItemUp(selectedKey, index)
                                }
                                disabled={index === 0}
                                className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                title="위로"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M5 15l7-7 7 7"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() =>
                                  moveItemDown(
                                    selectedKey,
                                    index,
                                    getItemsForKey(selectedKey).length
                                  )
                                }
                                disabled={
                                  index ===
                                  getItemsForKey(selectedKey).length - 1
                                }
                                className="p-1 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                                title="아래로"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() =>
                                  startEditItem(item.id, item.content)
                                }
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="수정"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="p-1 text-red-600 hover:text-red-800"
                                title="삭제"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>}
                          </>
                        )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 저장 버튼 */}
                {canEdit(selectedKey.split("_")[1]) && (
                  <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
                    <button className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                      새 프로젝트만 적용
                    </button>
                    <button className="px-6 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors">
                      모든 프로젝트 적용
                    </button>
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
      </main>

      {/* 항목 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              새 체크리스트 항목 추가
            </h3>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  유형
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={newItemIsRequired}
                      onChange={() => setNewItemIsRequired(true)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">필수</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={!newItemIsRequired}
                      onChange={() => setNewItemIsRequired(false)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">선택</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewItemContent("");
                  setNewItemIsRequired(true);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveNewItem}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              새 단계 추가
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단계 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="예: 6단계: Tx 단계"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  단계 유형
                </label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={newStageType === "work"}
                      onChange={() => setNewStageType("work")}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">작업 단계</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={newStageType === "gate"}
                      onChange={() => setNewStageType("gate")}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">게이트 미팅</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowStageModal(false);
                  setNewStageName("");
                  setNewStageType("work");
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={addNewStage}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              새 부서 추가
            </h3>

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
                onClick={() => {
                  setShowDepartmentModal(false);
                  setNewDepartmentName("");
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={addNewDepartment}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
