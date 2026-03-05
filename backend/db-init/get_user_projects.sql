CREATE OR REPLACE FUNCTION public.get_user_projects(
    user_id_param integer)
RETURNS TABLE(
    project_id integer,
    project_name text,
    role text,
    created_date timestamp without time zone,
    creator_name text,
    creator_profile_picture text,
    has_latest boolean,
    description text,
    last_modified_by text,
    last_modified_date timestamp without time zone
) 
LANGUAGE 'plpgsql'
COST 100
VOLATILE PARALLEL UNSAFE
ROWS 1000

AS $BODY$
BEGIN
    RETURN QUERY
    SELECT
        p.project_id,
        p.name::TEXT AS project_name,
        up.role::TEXT AS role,
        p.created_date::TIMESTAMP WITH TIME ZONE AT TIME ZONE 'UTC' AS created_date,
        COALESCE(u.full_name, 'Unknown')::TEXT AS creator_name,
        u.profile_pic::TEXT AS creator_profile_picture,
        NOT EXISTS (
            SELECT 1
            FROM file_version fv
            JOIN file_data fd ON fv.file_id = fd.file_data_id
            LEFT JOIN last_download ld
                ON fv.file_id = ld.file_id AND ld.user_id = up.user_id
            WHERE fd.project_id = p.project_id
            AND (fv.last_version = TRUE OR fv.version_id = (SELECT MAX(version_id) FROM file_version WHERE file_id = fv.file_id))
            AND (ld.version_id IS NULL OR ld.version_id < fv.version_id)
            AND fv.user_id != user_id_param -- Exclude the uploader from "not-up-to-date"
        ) AS has_latest,
        p.description::TEXT AS description,
        COALESCE((
            SELECT up2.full_name::TEXT
            FROM file_version fv2
            JOIN user_profile up2 ON fv2.user_id = up2.user_id
            JOIN file_data fd2 ON fv2.file_id = fd2.file_data_id
            WHERE fd2.project_id = p.project_id
            ORDER BY fv2.upload_date DESC
            LIMIT 1
        ), 'Unknown') AS last_modified_by,
        COALESCE((
            SELECT MAX(fv.upload_date)::TIMESTAMP WITH TIME ZONE AT TIME ZONE 'UTC'
            FROM file_version fv
            JOIN file_data fd ON fv.file_id = fd.file_data_id
            WHERE fd.project_id = p.project_id
        ), p.created_date::TIMESTAMP WITH TIME ZONE AT TIME ZONE 'UTC') AS last_modified_date
    FROM user_project up
    JOIN project p ON up.project_id = p.project_id
    LEFT JOIN user_profile u ON p.creator_id = u.user_id
    WHERE up.user_id = user_id_param
    ORDER BY
        has_latest ASC,
        last_modified_date DESC;
END;
$BODY$;

ALTER FUNCTION public.get_user_projects(integer)
    OWNER TO postgres;

