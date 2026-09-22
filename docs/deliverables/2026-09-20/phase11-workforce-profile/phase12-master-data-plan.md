# Phase 12 실제 Master Data 계획

이번 Phase는 스키마·화면·템플릿·읽기 전용 검증까지만 완료했다. 실제 Digital Square 직원/조직/자산/프로필 파일은 아직 받거나 적용하지 않았다. Phase 12에서 사용자가 제공하는 접근 제한 복사본으로 진행한다.

1. 기존 `organizations.code`, 사번, 프로젝트 코드와 파일 업무키의 대응표를 만들고 중복/누락/퇴사자 처리를 확인한다.
2. 기존 인력프로필 Excel을 Dry Run하고 경력년수의 기준일, 월 단위 프로젝트 기간, Skill/Certification 구분, 동일 프로젝트의 여러 투입을 사람이 확인한다.
3. 8개 추가 CSV를 기존 Phase 10 양식과 함께 검증한다. 내부 경력은 기존 Assignment의 직원·프로젝트·시작일과 대조한다.
4. 운영 DB backup/PITR 및 Preview를 확보하고, 사용자 검토 후 별도의 적용 도구/명령을 구현한다. 기존 UUID/관계와 Audit/Version/RLS를 유지하며 중복 실행은 업무키 기반으로 안전하게 처리한다.
5. Import 후 표본 프로필과 Excel Export를 원본과 대조한다. 사용자가 별도로 승인하지 않은 실제 데이터 Import는 수행하지 않는다.

대량 적용용 DB writer, Auth identity 생성/병합, 실제 운영 개인정보 보존 정책은 이번 Phase의 구현 범위 밖이다.
