export type ClassOf<T> = { new (...args: any[]): T }; // javascript is so weird... this syntax is disgusting lol

// Gets element by ID and checks that it is of the expected type
export function getByID<T extends Element>(
    id: string,
    myClass: ClassOf<T>
): T {
    const element = document.getElementById(id) as Element | null;
    if(!(element instanceof myClass)) {
        throw new Error(`getByID Failed. Element ID: ${id}`);
    }
    return element as T;
}

// Gets element by query selector
export function getByQuery<T extends Element>(
    query: string,
    myClass: ClassOf<T>
): T {
    const element = document.querySelector(query) as Element | null;
    if(!(element instanceof myClass)) {
        throw new Error(`getByQuery Failed. Query: ${query}`);
    }
    return element as T;
}

// Gets all elements matching query selector
export function getAllByQuery<T extends Element>(
    query: string,
    myClass: ClassOf<T>
): T[] {
    const elements = document.querySelectorAll(query) as NodeListOf<Element>;
    const result: T[] = [];
    elements.forEach(element => {
        if(!(element instanceof myClass)) {
            throw new Error(`getAllByQuery Failed. Query: ${query}`);
        }
        result.push(element as T);
    });
    return result;
}

// Remove all characters except a-z, 0-9, and whitespaces
export function validateSearch(searchTerm: string) {
    return searchTerm.replace(/[^a-z0-9\s]/gi, '');
}