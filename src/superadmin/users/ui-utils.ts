import { getAngkatan } from '../../shared/nim-utils';
import { UserStatus, STATUS_BADGE_STYLES, STATUS_DETAIL_STYLES, getSuspendLabel } from '../../shared/user-status';

/** Check if current logged-in user is Primary Super Admin */
const isPrimary = (): boolean => {
    return localStorage.getItem('auth_role_level') === 'primary';
};

export const getRoleBadge = (user: any) => {
    const role = user.role;
    const roleLevel = user.role_level;

    let label = role.charAt(0).toUpperCase() + role.slice(1);

    if (role === 'tendik' && ['kepala_lab', 'laboran'].includes(user.tendik_role)) {
        const labName = user.laboratory?.code || user.laboratory?.name || `Lab ${user.laboratory_id || '?'}`;
        const roleName = user.tendik_role === 'kepala_lab' ? 'Kepala Lab' : 'Laboran';
        label = `${roleName} (${labName})`;
    } else if (role === 'super_admin') {
        label = roleLevel === 'primary' ? 'Primary Admin' : 'Secondary Admin';
    } else if (role === 'mahasiswa') {
        label = 'Mahasiswa';
    } else if (role === 'tendik') {
        const sp = user.tendik_role === 'sarpras' ? 'Sarpras' : 'Persuratan';
        label = `Tendik (${sp})`;
    } else if (role === 'akademik') {
        const subRoleRaw = user.sub_role || '';
        const subRoleStr = subRoleRaw.charAt(0).toUpperCase() + subRoleRaw.slice(1);
        
        if (['kadep', 'sekdep'].includes(subRoleRaw.toLowerCase())) {
            const deptCode = user.department?.code ?? 'Unknown';
            const deptName = user.department?.name ?? '';
            label = `<span title="${deptName}">${subRoleStr} ${deptCode}</span>`;
        } else if (['kaprodi', 'sekprodi'].includes(subRoleRaw.toLowerCase())) {
            const progCode = user.study_program?.code ?? 'Unknown';
            const progName = user.study_program?.name ?? '';
            label = `<span title="${progName}">${subRoleStr} ${progCode}</span>`;
        } else {
            label = 'Akademik';
        }
    }
    return label;
};

type UserFormData = {
    tendikRole?: string;
    laboratoryId?: string;
    role?: string;
    [key: string]: any;
};

export const mapUserPayload = (data: UserFormData) => {
    const payload = { ...data };

    if (payload.tendikRole && payload.tendikRole.trim() !== '') {
        payload.tendik_role = payload.tendikRole.trim();
    }
    delete payload.tendikRole;
    
    if (payload.laboratoryId && payload.laboratoryId !== '') {
        const id = parseInt(payload.laboratoryId, 10);
        payload.laboratory_id = Number.isNaN(id) ? null : id;
    }
    delete payload.laboratoryId;

    if (payload.studyProgramId && payload.studyProgramId !== '') {
        const id = parseInt(payload.studyProgramId, 10);
        payload.study_program_id = Number.isNaN(id) ? null : id;
    }
    delete payload.studyProgramId;

    return payload;
};

/**
 * Build a clean, role-aware payload from raw FormData entries.
 * Handles all role-specific field cleanup, FK selection, and auto-password generation.
 *
 * @returns `{ data, error }` — if error is non-null, submission should be aborted.
 */
export const buildUserPayload = (
    rawData: Record<string, any>,
    assignedTasks: string[],
    isNewUser: boolean
): { data: any; error: string | null } => {
    const data = mapUserPayload(rawData);

    // Handle akademik fields: send correct FK based on sub_role
    if (data.role === 'akademik') {
        if (['kaprodi', 'sekprodi'].includes(data.sub_role)) {
            delete data.department_id;
            if (data.study_program_id) data.study_program_id = parseInt(data.study_program_id);
        } else if (['kadep', 'sekdep'].includes(data.sub_role)) {
            delete data.study_program_id;
            if (data.department_id) data.department_id = parseInt(data.department_id);
        }
    } else if (data.role === 'mahasiswa') {
        delete data.department_id;
        if (!data.study_program_id) {
            return { data: null, error: 'Program Studi wajib dipilih untuk Mahasiswa' };
        }
        data.study_program_id = parseInt(data.study_program_id);
    } else {
        delete data.study_program_id;
        delete data.department_id;
    }

    // Handle tendik fields
    if (data.role === 'tendik') {
        if (['kepala_lab', 'laboran'].includes(data.tendik_role)) {
            if (!data.laboratory_id) {
                return { data: null, error: 'Pilihan laboratorium tidak valid. Data laboratorium belum tersedia.' };
            }
        }
        if (data.tendik_role === 'persuratan') {
            data.assigned_tasks = Array.from(new Set(assignedTasks.filter(Boolean)));
        } else {
            delete data.assigned_tasks;
        }
        if (!['kepala_lab', 'laboran'].includes(data.tendik_role)) {
            delete data.laboratory_id;
        }
    } else {
        delete data.assigned_tasks;
        delete data.tendik_role;
        delete data.laboratory_id;
    }

    // Handle role_level: only for super_admin
    if (data.role !== 'super_admin') {
        delete data.role_level;
    }

    // Auto-generate mahasiswa password for new users
    if (isNewUser && data.role === 'mahasiswa') {
        const nim = (data.nim as string || '').replace(/[^a-zA-Z0-9]/g, '');
        const dobParts = (data.tanggal_lahir as string || '').split('-');
        const dobFormatted = dobParts.length === 3 ? `${dobParts[2]}${dobParts[1]}${dobParts[0]}` : '';
        data.password = `${nim}${dobFormatted}`;
    }

    return { data, error: null };
};

export const getRoleLevelBadge = (user: any) => {
    if (user.role !== 'super_admin') return '';
    if (user.role_level === 'primary') {
        return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Primary</span>`;
    }
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Secondary</span>`;
};

export const getStatusBadge = (status: string) => {
    const c = STATUS_BADGE_STYLES[status as keyof typeof STATUS_BADGE_STYLES]
        || { color: 'bg-gray-100 text-gray-700', label: status };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${c.color}">${c.label}</span>`;
};

export const renderUserRow = (user: any, isSuperAdminTab = false) => {
    const currentUserId = localStorage.getItem('auth_user_id');
    const isSelf = String(user.id) === String(currentUserId);
    const canManage = isPrimary();
    const isSuperAdminUser = user.role === 'super_admin';

    // For super admin tab, show role level column instead of role
    const roleCell = isSuperAdminTab
        ? `<td class="px-4 py-3.5">${getRoleLevelBadge(user)}</td>`
        : `<td class="px-4 py-3.5">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                    ${getRoleBadge(user)}
                </span>
            </td>`;

    // Action menu: respect permissions
    const showActions = isSuperAdminTab ? canManage && !isSelf : true;
    const showDelete = isSuperAdminUser ? (canManage && !isSelf) : true;
    const showBlock = isSuperAdminUser ? (canManage && !isSelf) : true;

    const actionMenu = showActions ? `
        <div class="relative inline-block text-left">
            <button class="kebab-btn w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all focus:outline-none" data-id="${user.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"></circle><circle cx="12" cy="12" r="1.75"></circle><circle cx="12" cy="19" r="1.75"></circle></svg>
            </button>
            <div class="kebab-menu hidden absolute right-0 z-[100] w-44 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-2 text-sm" data-id="${user.id}">
                <button class="edit-user-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-teal-700 transition-colors" data-id="${user.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit
                </button>
                ${showBlock ? `
                <button class="block-user-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors mt-0.5" data-id="${user.id}" data-status="${user.status}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    ${getSuspendLabel(user.status)}
                </button>` : ''}
                ${showDelete ? `
                <div class="h-px bg-gray-100 my-1.5 mx-1"></div>
                <button class="delete-user-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" data-id="${user.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Hapus
                </button>` : ''}
            </div>
        </div>
    ` : `<span class="text-xs text-gray-300">—</span>`;

    return `
        <tr class="hover:bg-gray-50/70 transition-colors group" data-id="${user.id}">
            <td class="px-6 py-3.5 border-b border-gray-50">
                <input type="checkbox" class="user-checkbox w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer" data-id="${user.id}">
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <span class="text-sm font-semibold text-gray-800">${user.name}</span>
                ${isSelf ? '<span class="ml-1.5 text-[9px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">Anda</span>' : ''}
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <span class="text-sm text-gray-400">${user.email}</span>
            </td>
            ${roleCell.replace('class="', 'class="border-b border-gray-50 ')}
            <td class="px-4 py-3.5 border-b border-gray-50">
                ${getStatusBadge(user.status || UserStatus.ACTIVE)}
            </td>
            <td class="px-2 py-2 text-right sticky right-0 bg-white group-hover:bg-gray-50/70 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] z-10 border-b border-gray-50 align-middle w-20">
                <div class="flex justify-end pr-4">
                    ${actionMenu}
                </div>
            </td>
        </tr>
    `;
};




export const renderMahasiswaRow = (user: any) => {
    const nim = user.mahasiswa_profile?.nim || user.mahasiswaProfile?.nim || '-';
    const prodiCode = user.study_program?.code || '-';
    const angkatan = getAngkatan(nim !== '-' ? nim : undefined);
    const status = user.status || UserStatus.ACTIVE;

    const actionMenu = `
        <div class="relative inline-block no-row-click text-left">
            <button class="kebab-btn no-row-click w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all focus:outline-none" data-id="${user.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"></circle><circle cx="12" cy="12" r="1.75"></circle><circle cx="12" cy="19" r="1.75"></circle></svg>
            </button>
            <div class="kebab-menu hidden absolute right-0 z-[100] w-44 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-2 text-sm no-row-click" data-id="${user.id}">
                <button class="edit-user-btn no-row-click w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 hover:text-teal-700 transition-colors" data-id="${user.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Edit
                </button>
                <button class="block-user-btn no-row-click w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors mt-0.5" data-id="${user.id}" data-status="${status}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                    ${getSuspendLabel(status)}
                </button>
                <div class="h-px bg-gray-100 my-1.5 mx-1"></div>
                <button class="delete-user-btn no-row-click w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" data-id="${user.id}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Hapus
                </button>
            </div>
        </div>
    `;

    return `
        <tr class="hover:bg-gray-50/70 transition-colors group cursor-pointer mhs-row" data-id="${user.id}">
            <td class="px-6 py-3.5 no-row-click border-b border-gray-50">
                <input type="checkbox" class="user-checkbox no-row-click w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer" data-id="${user.id}">
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-800">${user.name}</span>
                    <span class="text-[11px] text-gray-400">${user.email}</span>
                </div>
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <span class="text-sm text-gray-600 font-mono">${nim}</span>
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <span class="text-sm text-gray-600">${prodiCode}</span>
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                <span class="text-sm text-gray-600">${angkatan}</span>
            </td>
            <td class="px-4 py-3.5 border-b border-gray-50">
                ${getStatusBadge(status)}
            </td>
            <td class="px-2 py-2 text-right sticky right-0 bg-white group-hover:bg-gray-50/70 shadow-[-4px_0_12px_rgba(0,0,0,0.03)] z-10 border-b border-gray-50 no-row-click align-middle w-20">
                <div class="flex justify-end pr-4">
                    ${actionMenu}
                </div>
            </td>
        </tr>
    `;
};

export const renderMahasiswaDetailModal = (user: any) => {
    const nim = user.mahasiswa_profile?.nim || user.mahasiswaProfile?.nim || '-';
    const prodiCode = user.study_program?.code || '-';
    const prodiName = user.study_program?.name || '-';
    const deptCode = user.study_program?.department?.code || '-';
    const deptName = user.study_program?.department?.name || '-';
    const fakultasName = user.study_program?.department?.faculty?.name || '-';
    const angkatan = getAngkatan(nim !== '-' ? nim : undefined);
    const status = user.status || UserStatus.ACTIVE;
    const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

    const sc = STATUS_DETAIL_STYLES[status as keyof typeof STATUS_DETAIL_STYLES]
        || STATUS_DETAIL_STYLES[UserStatus.ACTIVE];

    const modalContainer = document.getElementById('modal-container')!;
    modalContainer.innerHTML = `
        <div id="mhs-detail-overlay" class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
                <!-- Header -->
                <div class="bg-teal-700 px-6 py-5 text-white">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold">${user.name}</h3>
                            <p class="text-teal-100 text-sm mt-0.5 font-mono">${nim}</p>
                        </div>
                        <button id="close-mhs-detail" class="hover:bg-white/10 p-1 rounded-lg transition-colors">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <div class="mt-3 flex items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}">
                            <span class="w-1.5 h-1.5 rounded-full ${sc.dot}"></span>
                            ${status}
                        </span>
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-white">Mahasiswa</span>
                    </div>
                </div>

                <!-- Body -->
                <div class="p-6 space-y-5">
                    <!-- Akademik Info -->
                    <div>
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Informasi Akademik</h4>
                        <div class="grid grid-cols-2 gap-x-6 gap-y-3">
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase">Program Studi</p>
                                <p class="text-sm font-semibold text-gray-800" title="${prodiName}">${prodiCode}</p>
                                <p class="text-[11px] text-gray-400">${prodiName}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase">Departemen</p>
                                <p class="text-sm font-semibold text-gray-800" title="${deptName}">${deptCode}</p>
                                <p class="text-[11px] text-gray-400">${deptName}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase">Fakultas</p>
                                <p class="text-sm font-semibold text-gray-800">${fakultasName}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase">Angkatan</p>
                                <p class="text-sm font-semibold text-gray-800">${angkatan}</p>
                            </div>
                        </div>
                    </div>

                    <div class="h-px bg-gray-100"></div>

                    <!-- Akun Info -->
                    <div>
                        <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Informasi Akun</h4>
                        <div class="space-y-3">
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase">Email</p>
                                <p class="text-sm text-gray-700 break-words leading-relaxed">${user.email}</p>
                            </div>
                            <div class="pt-3 border-t border-gray-100">
                                <p class="text-[10px] text-gray-400 uppercase">Tanggal Terdaftar</p>
                                <p class="text-xs text-gray-500">${createdAt}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button class="mhs-detail-edit-btn px-4 py-2 text-sm font-semibold bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all" data-id="${user.id}">Edit</button>
                    <button class="mhs-detail-block-btn px-4 py-2 text-sm font-semibold bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-all" data-id="${user.id}" data-status="${status}">
                        ${getSuspendLabel(status)}
                    </button>
                    <button class="mhs-detail-delete-btn px-4 py-2 text-sm font-semibold bg-red-50 border border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition-all" data-id="${user.id}">Hapus</button>
                </div>
            </div>
        </div>
    `;

    // Close handlers
    const closeDetail = () => {
        modalContainer.innerHTML = '';
        document.removeEventListener('keydown', escHandler);
    };
    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeDetail();
    };
    document.getElementById('close-mhs-detail')?.addEventListener('click', closeDetail);
    document.addEventListener('keydown', escHandler);
    document.getElementById('mhs-detail-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeDetail();
    });
};

const getGroupValue = (user: any, key: string): string => {
    switch (key) {
        case 'role_level':
            return user.role_level === 'primary' ? 'PRIMARY' : 'SECONDARY';
        case 'department':
            return user.department?.name || user.department?.code || 'Departemen Tidak Diketahui';
        case 'study_program':
            return user.study_program?.name || user.study_program?.code || 'Program Studi Tidak Diketahui';
        case 'tendik_role':
            return user.tendik_role ? user.tendik_role.toUpperCase() : 'LAINNYA';
        default:
            return 'Lainnya';
    }
};

const renderGroupedUsers = (users: any[], config: string[], isSuperAdminTab: boolean, isMahasiswaTab: boolean, depth = 0): string => {
    if (users.length === 0) return '';
    
    // Base case: lowest level reached, apply alphabetical sorting
    if (depth >= config.length) {
        const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
        if (isMahasiswaTab) {
            return sorted.map(user => renderMahasiswaRow(user)).join('');
        }
        return sorted.map(user => renderUserRow(user, isSuperAdminTab)).join('');
    }

    const key = config[depth];
    const grouped = new Map<string, any[]>();
    
    users.forEach(user => {
        const val = getGroupValue(user, key);
        if (!grouped.has(val)) grouped.set(val, []);
        grouped.get(val)!.push(user);
    });

    // Sort group headers
    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
        if (key === 'role_level') return a === 'PRIMARY' ? -1 : 1;
        if (key === 'tendik_role') {
            const order = ['PERSURATAN', 'SARPRAS', 'KEPALA_LAB', 'LABORAN'];
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            return (idxA > -1 ? idxA : 99) - (idxB > -1 ? idxB : 99);
        }
        
        // Push "Tidak Diketahui" to the top so they render without headers seamlessly
        if (a.includes('Tidak Diketahui') && !b.includes('Tidak Diketahui')) return -1;
        if (!a.includes('Tidak Diketahui') && b.includes('Tidak Diketahui')) return 1;
        
        return a.localeCompare(b);
    });

    let html = '';
    sortedKeys.forEach(groupName => {
        const groupUsers = grouped.get(groupName)!;
        
        // Skip rendering redundant/unknown headers to keep UI clean
        if (!groupName.includes('Tidak Diketahui')) {
            const padding = depth * 4;
            const colspan = isMahasiswaTab ? '7' : '6';
            html += `
                <tr class="bg-gray-50/50 border-y border-gray-100">
                    <td colspan="${colspan}" class="px-6 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider" style="padding-left: ${1.5 + padding}rem;">
                        ${groupName}
                    </td>
                </tr>
            `;
        }
        
        html += renderGroupedUsers(groupUsers, config, isSuperAdminTab, isMahasiswaTab, depth + 1);
    });

    return html;
};

export const renderFilteredRows = (users: any[], roles: string[], search = '', statusFilter = '') => {
    const isSuperAdminTab = roles.includes('super_admin');
    
    const filtered = users.filter(u => {
        const matchRole = roles.some(r => u.role === r || u.role?.startsWith(r));
        
        // Comprehensive search: name, email, and nim
        const searchLower = search.toLowerCase();
        const matchSearch = !search || 
            u.name.toLowerCase().includes(searchLower) || 
            u.email.toLowerCase().includes(searchLower) || 
            (u.mahasiswa_profile?.nim?.toLowerCase().includes(searchLower)) ||
            (u.mahasiswaProfile?.nim?.toLowerCase().includes(searchLower));
            
        const matchStatus = !statusFilter || u.status === statusFilter;
        
        return matchRole && matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        const colspan = roles.includes('mahasiswa') ? '7' : '6';
        return `<tr><td colspan="${colspan}" class="px-6 py-12 text-center text-sm text-gray-400">Tidak ada data pengguna.</td></tr>`;
    }

    // Config-based grouping engine
    let groupingConfig: string[] = [];
    const isMahasiswaTab = roles.includes('mahasiswa');
    if (roles.includes('super_admin')) {
        groupingConfig = ['role_level'];
    } else if (roles.includes('akademik')) {
        groupingConfig = ['department', 'study_program'];
    } else if (roles.includes('tendik')) {
        groupingConfig = ['tendik_role'];
    } else if (isMahasiswaTab) {
        groupingConfig = ['study_program'];
    }

    return renderGroupedUsers(filtered, groupingConfig, isSuperAdminTab, isMahasiswaTab);
};
