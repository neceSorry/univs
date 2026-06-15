import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Institute } from './entities/institute.entity';
import { Department } from './entities/department.entity';
import { Program } from './entities/program.entity';
import { Group } from './entities/group.entity';
import { Teacher } from './entities/teacher.entity';
import { Student } from './entities/student.entity';
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
import { GradeBookEntry } from './entities/grade-book-entry.entity';

import { AuthModule } from './auth/auth.module';
import { InstitutesModule } from './modules/institutes.module';
import { DepartmentsModule } from './modules/departments.module';
import { ProgramsModule } from './modules/programs.module';
import { GroupsModule } from './modules/groups.module';
import { StudentsModule } from './modules/students.module';
import { TeachersModule } from './modules/teachers.module';
import { DisciplinesModule } from './modules/disciplines.module';
import { CurriculumModule } from './modules/curriculum.module';
import { TeacherCabinetModule } from './modules/teacher-cabinet.module';
import { GradesModule } from './modules/grades.module';
import { AttendanceModule } from './modules/attendance.module';
import { MaterialsModule } from './modules/materials.module';
import { StudentCabinetModule } from './modules/student-cabinet.module';
import { ScheduleModule } from './modules/schedule.module';
import { ExamsModule } from './modules/exams.module';
import { PaymentsModule } from './modules/payments.module';
import { AnalyticsModule } from './modules/analytics.module';
import { SharedModule } from './common/shared.module';
import { AdminPermissionsModule } from './modules/admin-permissions/admin-permissions.module';
import { TeacherPreferencesModule } from './modules/teacher-preferences/teacher-preferences.module';
import { StreamsModule } from './modules/streams/streams.module';
import { ScheduleVersionsModule } from './modules/schedule-versions/schedule-versions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
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
        Permission, AdminPermission, TeacherPreference,
        Stream, StreamGroup, ScheduleVersion, GradeBookEntry,
      ],
      synchronize: true,
      logging: ['error', 'warn'],
    }),
    AuthModule,
    SharedModule,
    InstitutesModule,
    DepartmentsModule,
    ProgramsModule,
    GroupsModule,
    StudentsModule,
    TeachersModule,
    DisciplinesModule,
    CurriculumModule,
    TeacherCabinetModule,
    GradesModule,
    AttendanceModule,
    MaterialsModule,
    StudentCabinetModule,
    ScheduleModule,
    ExamsModule,
    PaymentsModule,
    AnalyticsModule,
    AdminPermissionsModule,
    TeacherPreferencesModule,
    StreamsModule,
    ScheduleVersionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
