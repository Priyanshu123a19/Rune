import { api } from '@/trpc/react'
import React from 'react'
import { useLocalStorage} from 'usehooks-ts'

const Useproject = () => {

    //now over here we want to recall one thing
    //!the userquery method is always used fpr the methods where u are getting / fetchng the data
    //! and the second thing is that whenever we are using this to send some data then we will be using the mutatiopn function
    //we are calling the project api endpoint in the trpc routes that we have set and also used to querry it is the mathod we defined ther in the routes called as getprojects
    const {data: projects}= api.project.getProjects.useQuery();
    //now over here we will be using the concept of local storage that makes us store the project details in the local storage so that
    //even when we refresh the page then also we will be able to get the user previously selected project details
    const [projectId, setProjectId] = useLocalStorage('projectId', ' ');
    //getting the project details
    const project = projects?.find((project) => project.id === projectId);

    return {
        projectId,
        setProjectId,
        project,
        projects
    }
}

export default Useproject