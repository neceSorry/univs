import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from './entities/user.entity';
import { Institute } from './entities/institute.entity';
import { Department } from './entities/department.entity';
import { Program, DegreeType } from './entities/program.entity';
import { Group } from './entities/group.entity';
import { Teacher } from './entities/teacher.entity';
import { Student, Gender, EnrollmentType, StudentStatus } from './entities/student.entity';
import { Discipline } from './entities/discipline.entity';
import { Classroom } from './entities/classroom.entity';
import { CurriculumPlan } from './entities/curriculum-plan.entity';
import { CurriculumItem } from './entities/curriculum-item.entity';
import { ScheduleSlot } from './entities/schedule-slot.entity';
import { Grade } from './entities/grade.entity';
import { Attendance } from './entities/attendance.entity';
import { Exam } from './entities/exam.entity';
import { ExamResult } from './entities/exam-result.entity';
import { Payment } from './entities/payment.entity';
import { CourseMaterial } from './entities/course-material.entity';
import { Permission } from './entities/permission.entity';
import { AdminPermission } from './entities/admin-permission.entity';
import { TeacherPreference } from './entities/teacher-preference.entity';
import { Stream } from './entities/stream.entity';
import { StreamGroup } from './entities/stream-group.entity';
import { ScheduleVersion } from './entities/schedule-version.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5433'),
  username: process.env.DB_USER ?? 'admin',
  password: process.env.DB_PASSWORD ?? 'secret',
  database: process.env.DB_NAME ?? 'university_db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  entities: [
    User, Institute, Department, Program, Group, Teacher, Student,
    Discipline, Classroom, CurriculumPlan, CurriculumItem, ScheduleSlot,
    Grade, Attendance, Exam, ExamResult, Payment, CourseMaterial,
    Permission, AdminPermission, TeacherPreference, Stream, StreamGroup, ScheduleVersion,
  ],
  synchronize: true,
});

async function runSeed() {
  await AppDataSource.initialize();
  console.log('Database connected. Starting seed...');

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash('admin123', salt);

  // 1. Seed permissions
  const permissionData = [
    { code: 'schedule.input', description: 'Вносить данные для расписания' },
    { code: 'schedule.generate', description: 'Запускать генерацию расписания' },
    { code: 'schedule.edit', description: 'Корректировать расписание вручную' },
    { code: 'schedule.publish', description: 'Утверждать и публиковать расписание' },
    { code: 'view.structure', description: 'Просмотр структуры университета' },
    { code: 'structure.write', description: 'Изменение структуры университета' },
    { code: 'view.people', description: 'Просмотр преподавателей и студентов' },
    { code: 'people.write', description: 'Добавление и удаление людей' },
    { code: 'view.curriculum', description: 'Просмотр учебных планов' },
    { code: 'curriculum.write', description: 'Редактирование учебных планов' },
    { code: 'view.grades', description: 'Просмотр оценок студентов' },
    { code: 'grades.write', description: 'Выставление оценок вручную' },
    { code: 'grades.override', description: 'Выставление оценок после истечения срока' },
    { code: 'view.exams', description: 'Просмотр экзаменов' },
    { code: 'exams.write', description: 'Управление экзаменами' },
    { code: 'payments.write', description: 'Управление оплатами' },
    { code: 'analytics.view', description: 'Просмотр аналитики' },
  ];

  for (const p of permissionData) {
    const exists = await AppDataSource.manager.findOne(Permission, { where: { code: p.code } });
    if (!exists) {
      await AppDataSource.manager.save(AppDataSource.manager.create(Permission, p));
    }
  }
  console.log('17 permissions seeded.');

  // 2. Create super admin
  let admin = await AppDataSource.manager.findOne(User, { where: { email: 'admin@university.edu' } });
  if (!admin) {
    admin = new User();
    admin.email = 'admin@university.edu';
    admin.username = 'admin';
    admin.password_hash = password_hash;
    admin.role = UserRole.ADMIN;
    admin.is_super_admin = true;
    await AppDataSource.manager.save(admin);
    console.log('Super admin created.');
  } else {
    admin.username = admin.username ?? 'admin';
    admin.is_super_admin = true;
    await AppDataSource.manager.save(admin);
    console.log('Existing admin upgraded to super admin.');
  }

  // 3. Institutes
  let inst1 = await AppDataSource.manager.findOne(Institute, { where: { short_name: 'ИИТ' } });
  if (!inst1) {
    inst1 = new Institute();
    inst1.name = 'Институт информационных технологий';
    inst1.short_name = 'ИИТ';
    await AppDataSource.manager.save(inst1);
  }

  let inst2 = await AppDataSource.manager.findOne(Institute, { where: { short_name: 'ИЭБ' } });
  if (!inst2) {
    inst2 = new Institute();
    inst2.name = 'Институт экономики и бизнеса';
    inst2.short_name = 'ИЭБ';
    await AppDataSource.manager.save(inst2);
  }
  console.log('Institutes ready.');

  // 4. Departments
  let dep1 = await AppDataSource.manager.findOne(Department, { where: { short_name: 'ПИ' } });
  if (!dep1) {
    dep1 = new Department();
    dep1.name = 'Кафедра программной инженерии';
    dep1.short_name = 'ПИ';
    dep1.institute = inst1;
    await AppDataSource.manager.save(dep1);
  }

  let dep2 = await AppDataSource.manager.findOne(Department, { where: { short_name: 'ИБ' } });
  if (!dep2) {
    dep2 = new Department();
    dep2.name = 'Кафедра информационной безопасности';
    dep2.short_name = 'ИБ';
    dep2.institute = inst1;
    await AppDataSource.manager.save(dep2);
  }

  let dep3 = await AppDataSource.manager.findOne(Department, { where: { short_name: 'МЕН' } });
  if (!dep3) {
    dep3 = new Department();
    dep3.name = 'Кафедра менеджмента';
    dep3.short_name = 'МЕН';
    dep3.institute = inst2;
    await AppDataSource.manager.save(dep3);
  }
  console.log('Departments ready.');

  // 5. Programs
  let prog1 = await AppDataSource.manager.findOne(Program, { where: { code: '09.03.04' } });
  if (!prog1) {
    prog1 = new Program();
    prog1.name = 'Программная инженерия';
    prog1.code = '09.03.04';
    prog1.degree = DegreeType.BACHELOR;
    prog1.duration_years = 4;
    prog1.department = dep1;
    await AppDataSource.manager.save(prog1);
  }

  let prog2 = await AppDataSource.manager.findOne(Program, { where: { code: '10.03.01' } });
  if (!prog2) {
    prog2 = new Program();
    prog2.name = 'Информационная безопасность';
    prog2.code = '10.03.01';
    prog2.degree = DegreeType.BACHELOR;
    prog2.duration_years = 4;
    prog2.department = dep2;
    await AppDataSource.manager.save(prog2);
  }
  console.log('Programs ready.');

  // 6. Groups
  const groupDefs = [
    { name: 'ПИ-21-1', year_of_entry: 2021, program: prog1 },
    { name: 'ПИ-22-1', year_of_entry: 2022, program: prog1 },
    { name: 'ИБ-21-1', year_of_entry: 2021, program: prog2 },
  ];
  const createdGroups: Group[] = [];
  for (const gd of groupDefs) {
    let g = await AppDataSource.manager.findOne(Group, { where: { name: gd.name } });
    if (!g) {
      g = new Group();
      g.name = gd.name;
      g.year_of_entry = gd.year_of_entry;
      g.program = gd.program;
      await AppDataSource.manager.save(g);
    }
    createdGroups.push(g);
  }
  const [group1, group2, group3] = createdGroups;
  console.log('Groups ready.');

  // 7. Teachers
  const deps = [dep1, dep1, dep2, dep3, dep3];
  const teacherUsers: User[] = [];
  for (let i = 1; i <= 5; i++) {
    let user = await AppDataSource.manager.findOne(User, { where: { email: `teacher${i}@university.edu` } });
    if (!user) {
      user = new User();
      user.email = `teacher${i}@university.edu`;
      user.username = `teacher${i}`;
      user.password_hash = password_hash;
      user.role = UserRole.TEACHER;
      await AppDataSource.manager.save(user);
    } else {
      user.username = user.username ?? `teacher${i}`;
      await AppDataSource.manager.save(user);
    }
    teacherUsers.push(user);

    let teacher = await AppDataSource.manager.findOne(Teacher, { where: { user: { id: user.id } } });
    if (!teacher) {
      teacher = new Teacher();
      teacher.first_name = `TeacherName${i}`;
      teacher.last_name = `TeacherLast${i}`;
      teacher.department = deps[i - 1];
      teacher.user = user;
      await AppDataSource.manager.save(teacher);
    }
  }
  console.log('Teachers ready.');

  // 8. Students
  const groups = [group1, group1, group1, group2, group2, group2, group3, group3, group3, group3];
  for (let i = 1; i <= 10; i++) {
    let user = await AppDataSource.manager.findOne(User, { where: { email: `student${i}@university.edu` } });
    if (!user) {
      user = new User();
      user.email = `student${i}@university.edu`;
      user.username = `student${i}`;
      user.password_hash = password_hash;
      user.role = UserRole.STUDENT;
      await AppDataSource.manager.save(user);
    } else {
      user.username = user.username ?? `student${i}`;
      await AppDataSource.manager.save(user);
    }

    let student = await AppDataSource.manager.findOne(Student, { where: { user: { id: user.id } } });
    if (!student) {
      student = new Student();
      student.first_name = `StudentName${i}`;
      student.last_name = `StudentLast${i}`;
      student.gender = i % 2 === 0 ? Gender.MALE : Gender.FEMALE;
      student.enrollment_type = i % 3 === 0 ? EnrollmentType.CONTRACT : EnrollmentType.BUDGET;
      student.status = StudentStatus.ACTIVE;
      student.group = groups[i - 1];
      student.user = user;
      await AppDataSource.manager.save(student);
    }
  }
  console.log('Students ready.');

  await AppDataSource.destroy();
  console.log('Seeding completed successfully!');
}

runSeed().catch(err => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
