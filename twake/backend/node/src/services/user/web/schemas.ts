const userObjectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    provider: { type: "string" },
    provider_id: { type: "string" },

    email: { type: "string" },
    is_verified: { type: "boolean" },
    picture: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    created_at: { type: "number" },
    deleted: { type: "boolean" },

    status: { type: "string" },
    last_activity: { type: "number" },

    //Below is only if this is myself

    preference: {
      type: "object",
      properties: {
        locale: { type: "string" },
        timezone: { type: "number" },
      },
    },

    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["owner", "admin", "member", "guest"] },
          status: { type: "string", enum: ["owner", "deactivated", "invited"] },
          company: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              logo: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const companyObjectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    logo: { type: "string" },
    plan: {
      type: ["object", "null"],
      properties: {
        name: { type: "string" },
        limits: {
          type: "object",
          properties: {
            members: { type: "number" },
            guests: { type: "number" },
            storage: { type: "number" },
          },
        },
      },
    },
    stats: {
      type: ["object", "null"],
      properties: {
        created_at: { type: "number" },
        total_members: { type: "number" },
        total_guests: { type: "number" },
      },
    },
    role: { type: "string", enum: ["owner", "admin", "member", "guest"] },
    status: { type: "string", enum: ["owner", "deactivated", "invited"] },
  },
};

export const getUserSchema = {
  response: {
    "2xx": {
      type: "object",
      properties: {
        resource: userObjectSchema,
      },
      required: ["resource"],
    },
  },
};

export const getUsersSchema = {
  type: "object",
  properties: {
    user_ids: { type: "string" },
    include_companies: { type: "boolean" },
  },
  response: {
    "2xx": {
      type: "object",
      properties: {
        resources: { type: "array", items: userObjectSchema },
      },
      required: ["resources"],
    },
  },
};

export const getUserCompaniesSchema = {
  type: "object",
  response: {
    "2xx": {
      type: "object",
      properties: {
        resources: { type: "array", items: companyObjectSchema },
      },
      required: ["resources"],
    },
  },
};

export const getCompanySchema = {
  type: "object",
  response: {
    "2xx": {
      type: "object",
      properties: {
        resource: companyObjectSchema,
      },
      required: ["resource"],
    },
  },
};
